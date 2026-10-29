import type {
  AnalyzedSession,
  ModelStat,
  ProjectStat,
  StatsSummary,
  StatsTimelinePoint,
} from '@chat-analyze/shared';

/**
 * A session counts towards statistics when it has at least one user turn.
 * `scoreable` is the explicit flag set by parsers; older cached sessions only
 * have `stats.userTurns`, hence the fallback.
 */
export function isScoreable(session: AnalyzedSession): boolean {
  return (
    session.expressionQuality.scoreable !== false && session.stats.userTurns > 0
  );
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(
    values.reduce((acc, value) => acc + value, 0) / values.length,
  );
}

/**
 * Single implementation of every aggregate the API exposes.
 *
 * Empty sessions are excluded from every average (they used to score 100 and
 * inflate the dashboard); `summary.total` still reports the raw session count.
 */
export class StatsService {
  summary(sessions: AnalyzedSession[]): StatsSummary {
    const scoreable = sessions.filter(isScoreable);

    return {
      total: sessions.length,
      avgScore: average(scoreable.map((s) => s.expressionQuality.score)),
      totalTokens: sessions.reduce(
        (acc, session) => acc + session.stats.tokenUsage.total,
        0,
      ),
    };
  }

  /**
   * One point per day that has at least one scoreable session.
   *
   * `avgScore` only averages scoreable sessions, while `sessionCount` /
   * `totalTokens` cover every session of that day so the dashboard cards add
   * up. Days with only empty sessions are omitted to keep 0 out of the chart.
   */
  timeline(sessions: AnalyzedSession[]): StatsTimelinePoint[] {
    const groups = new Map<
      string,
      { scores: number[]; sessionCount: number; totalTokens: number }
    >();

    for (const session of sessions) {
      const date = session.startTime.split('T')[0];
      const group = groups.get(date) ?? {
        scores: [],
        sessionCount: 0,
        totalTokens: 0,
      };

      group.sessionCount++;
      group.totalTokens += session.stats.tokenUsage.total;
      if (isScoreable(session)) {
        group.scores.push(session.expressionQuality.score);
      }

      groups.set(date, group);
    }

    return [...groups.entries()]
      .filter(([, group]) => group.scores.length > 0)
      .map(([date, group]) => ({
        date,
        avgScore: average(group.scores),
        sessionCount: group.sessionCount,
        totalTokens: group.totalTokens,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  byModel(sessions: AnalyzedSession[]): ModelStat[] {
    const groups = new Map<string, AnalyzedSession[]>();

    for (const session of sessions) {
      if (!isScoreable(session)) continue;
      const modelId = session.modelId || 'unknown';
      const group = groups.get(modelId) ?? [];
      group.push(session);
      groups.set(modelId, group);
    }

    return [...groups.entries()]
      .map(([modelId, group]) => ({
        modelId,
        sessionCount: group.length,
        avgScore: average(group.map((s) => s.expressionQuality.score)),
        avgTokens: average(group.map((s) => s.stats.tokenUsage.total)),
        avgTurns: average(group.map((s) => s.stats.turns)),
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  byProject(sessions: AnalyzedSession[]): ProjectStat[] {
    const groups = new Map<string, AnalyzedSession[]>();

    for (const session of sessions) {
      if (!isScoreable(session)) continue;
      const group = groups.get(session.projectName) ?? [];
      group.push(session);
      groups.set(session.projectName, group);
    }

    return [...groups.entries()]
      .map(([projectName, group]) => ({
        projectName,
        sessionCount: group.length,
        totalQuestions: group.reduce(
          (acc, session) => acc + session.stats.userTurns,
          0,
        ),
        avgScore: average(group.map((s) => s.expressionQuality.score)),
      }))
      .sort((a, b) => b.totalQuestions - a.totalQuestions);
  }
}
