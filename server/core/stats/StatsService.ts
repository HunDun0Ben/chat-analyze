import { AnalyzedSession } from '../../types/index.js';

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
  summary(sessions: AnalyzedSession[]): {
    total: number;
    avgScore: number;
    totalTokens: number;
  } {
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

  timeline(sessions: AnalyzedSession[]): { date: string; avgScore: number }[] {
    const groups = new Map<string, number[]>();

    for (const session of sessions) {
      if (!isScoreable(session)) continue;
      const date = session.startTime.split('T')[0];
      const scores = groups.get(date) ?? [];
      scores.push(session.expressionQuality.score);
      groups.set(date, scores);
    }

    return [...groups.entries()]
      .map(([date, scores]) => ({ date, avgScore: average(scores) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  byModel(sessions: AnalyzedSession[]): {
    modelId: string;
    sessionCount: number;
    avgScore: number;
    avgTokens: number;
    avgTurns: number;
  }[] {
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

  byProject(sessions: AnalyzedSession[]): {
    projectName: string;
    sessionCount: number;
    totalQuestions: number;
    avgScore: number;
  }[] {
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
