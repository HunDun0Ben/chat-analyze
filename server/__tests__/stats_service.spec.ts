import { describe, expect, it } from 'vitest';
import { StatsService, isScoreable } from '../core/stats/StatsService.js';
import { AnalyzedSession } from '../types/index.js';

function session(overrides: Partial<AnalyzedSession> = {}): AnalyzedSession {
  return {
    sessionId: 's1',
    projectName: 'demo',
    projectHash: 'h',
    modelId: 'gemini-pro',
    category: 'Coding',
    provider: 'gemini',
    startTime: '2026-01-01T00:00:00.000Z',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    expressionQuality: {
      score: 80,
      scoreable: true,
      ambiguities: [],
      suggestion: '',
    },
    stats: {
      turns: 4,
      totalMessages: 4,
      userTurns: 2,
      assistantTurns: 2,
      geminiTurns: 2,
      corrections: 0,
      toolChain: [],
      tokenUsage: { input: 1, output: 1, thoughts: 0, total: 100 },
    },
    messages: [],
    ...overrides,
  };
}

function emptySession(
  overrides: Partial<AnalyzedSession> = {},
): AnalyzedSession {
  return session({
    sessionId: 'empty',
    expressionQuality: {
      score: 100,
      scoreable: false,
      ambiguities: [],
      suggestion: '',
    },
    stats: {
      turns: 0,
      totalMessages: 0,
      userTurns: 0,
      assistantTurns: 0,
      geminiTurns: 0,
      corrections: 0,
      toolChain: [],
      tokenUsage: { input: 0, output: 0, thoughts: 0, total: 0 },
    },
    ...overrides,
  });
}

describe('isScoreable', () => {
  it('requires a user turn and a positive scoreable flag', () => {
    expect(isScoreable(session())).toBe(true);
    expect(isScoreable(emptySession())).toBe(false);
    expect(
      isScoreable(session({ stats: { ...session().stats, userTurns: 0 } })),
    ).toBe(false);
    expect(
      isScoreable(
        session({
          expressionQuality: {
            ...session().expressionQuality,
            scoreable: false,
          },
        }),
      ),
    ).toBe(false);
  });

  it('falls back to userTurns for legacy sessions without the flag', () => {
    const legacy = session();
    delete legacy.expressionQuality.scoreable;

    expect(isScoreable(legacy)).toBe(true);
  });
});

describe('StatsService.summary', () => {
  it('reports the raw total but averages only scoreable sessions', () => {
    const stats = new StatsService();
    const result = stats.summary([
      session({ sessionId: 'a' }),
      session({
        sessionId: 'b',
        expressionQuality: { score: 60, ambiguities: [], suggestion: '' },
      }),
      emptySession(),
    ]);

    expect(result.total).toBe(3);
    expect(result.avgScore).toBe(70);
  });

  it('returns zero averages for an empty dataset', () => {
    expect(new StatsService().summary([])).toEqual({
      total: 0,
      avgScore: 0,
      totalTokens: 0,
    });
  });
});

describe('StatsService.timeline', () => {
  it('excludes empty sessions and groups by day ascending', () => {
    const stats = new StatsService();
    const result = stats.timeline([
      session({ sessionId: 'a', startTime: '2026-01-02T10:00:00.000Z' }),
      session({
        sessionId: 'b',
        startTime: '2026-01-02T12:00:00.000Z',
        expressionQuality: { score: 60, ambiguities: [], suggestion: '' },
      }),
      session({ sessionId: 'c', startTime: '2026-01-01T10:00:00.000Z' }),
      emptySession(),
    ]);

    expect(result).toEqual([
      { date: '2026-01-01', avgScore: 80, sessionCount: 2, totalTokens: 100 },
      { date: '2026-01-02', avgScore: 70, sessionCount: 2, totalTokens: 200 },
    ]);
  });
});

describe('StatsService.byModel / byProject', () => {
  it('aggregates score, tokens and turns per model', () => {
    const stats = new StatsService();
    const result = stats.byModel([
      session({ sessionId: 'a', modelId: 'm1' }),
      session({
        sessionId: 'b',
        modelId: 'm1',
        expressionQuality: { score: 60, ambiguities: [], suggestion: '' },
      }),
      emptySession({ modelId: 'm1' }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      modelId: 'm1',
      sessionCount: 2,
      avgScore: 70,
      avgTokens: 100,
      avgTurns: 4,
    });
  });

  it('counts questions from user turns per project', () => {
    const stats = new StatsService();
    const result = stats.byProject([
      session({ sessionId: 'a', projectName: 'p1' }),
      session({ sessionId: 'b', projectName: 'p2' }),
      emptySession({ projectName: 'p1' }),
    ]);

    expect(result).toEqual([
      { projectName: 'p1', sessionCount: 1, totalQuestions: 2, avgScore: 80 },
      { projectName: 'p2', sessionCount: 1, totalQuestions: 2, avgScore: 80 },
    ]);
  });
});
