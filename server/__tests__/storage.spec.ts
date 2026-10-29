import { afterEach, describe, expect, it } from 'vitest';
import { SessionStorage } from '../db/storage.js';
import { AnalyzedSession } from '../types/index.js';

let idCounter = 0;

function session(overrides: Partial<AnalyzedSession> = {}): AnalyzedSession {
  idCounter++;
  return {
    sessionId: `storage-${idCounter}`,
    projectName: 'demo',
    projectHash: 'h',
    modelId: 'm',
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
      turns: 2,
      userTurns: 1,
      geminiTurns: 1,
      corrections: 0,
      toolChain: [],
      tokenUsage: { input: 1, output: 1, thoughts: 0, total: 2 },
    },
    messages: [],
    filePath: '/tmp/a.json',
    ...overrides,
  };
}

const stores: SessionStorage[] = [];

function store(): SessionStorage {
  const created = new SessionStorage(':memory:');
  stores.push(created);
  return created;
}

afterEach(() => {
  for (const created of stores.splice(0)) created.close();
  idCounter = 0;
});

describe('SessionStorage (design retained, writes disabled at runtime)', () => {
  it('deletes every row that belongs to a file path', () => {
    const storage = store();
    storage.saveSession(session({ filePath: '/tmp/a.json' }));
    storage.saveSession(session({ filePath: '/tmp/a.json' }));
    storage.saveSession(session({ filePath: '/tmp/b.json' }));

    expect(storage.deleteByFilePath('/tmp/a.json')).toBe(2);
    expect(storage.getSessions().map((s) => s.filePath)).toEqual([
      '/tmp/b.json',
    ]);
  });

  it('returns the latest 30 days of the timeline, ascending', () => {
    const storage = store();
    for (let offset = 0; offset < 35; offset++) {
      const startTime = new Date(Date.UTC(2026, 0, 1 + offset)).toISOString();
      storage.saveSession(session({ startTime }));
    }

    const timeline = storage.getStatsTimeline();

    expect(timeline).toHaveLength(30);
    expect(timeline[0].date).toBe('2026-01-06');
    expect(timeline[29].date).toBe('2026-02-04');
  });

  it('persists the file path column for future cache lookups', () => {
    const storage = store();
    storage.saveSession(session({ filePath: '/tmp/c.json' }));

    expect(storage.getSessionById('storage-1')?.filePath).toBe('/tmp/c.json');
  });
});
