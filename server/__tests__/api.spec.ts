import { describe, expect, it, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp, SessionManagerLike } from '../app.js';
import { AnalyzedSession } from '../types/index.js';

const EXPORTS_DIR = '/tmp/chat-analyze-test-exports';

function makeSession(
  overrides: Partial<AnalyzedSession> = {},
): AnalyzedSession {
  return {
    sessionId: 'session-1',
    projectName: 'demo',
    sessionTitle: 'Demo session',
    projectHash: 'hash-1',
    modelId: 'gemini-pro',
    category: 'Coding',
    provider: 'gemini',
    startTime: '2026-01-01T00:00:00.000Z',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    expressionQuality: { score: 80, ambiguities: [], suggestion: '' },
    stats: {
      turns: 2,
      userTurns: 1,
      geminiTurns: 1,
      corrections: 0,
      toolChain: [],
      tokenUsage: { input: 1, output: 1, thoughts: 0, total: 2 },
    },
    messages: [
      {
        id: 'm1',
        timestamp: '2026-01-01T00:00:00.000Z',
        type: 'user',
        content: 'how do I reset the cache?',
      },
      {
        id: 'm2',
        timestamp: '2026-01-01T00:00:01.000Z',
        type: 'gemini',
        content: 'use FLUSHDB',
      },
    ],
    filePath: '/tmp/session-1.json',
    ...overrides,
  };
}

function makeManager(sessions: AnalyzedSession[]): SessionManagerLike {
  return {
    getAllSessions: () => sessions,
    getSession: (id) => sessions.find((s) => s.sessionId === id) ?? null,
    getProjects: (provider) => [
      ...new Set(
        sessions
          .filter((s) => !provider || s.provider === provider)
          .map((s) => s.projectName),
      ),
    ],
    getSessionsByProject: (projectName) =>
      sessions.filter((s) => s.projectName === projectName),
    getStats: () => ({
      total: sessions.length,
      avgScore: 80,
      totalTokens: 2,
    }),
  };
}

function appWith(sessions: AnalyzedSession[]) {
  return createApp({ manager: makeManager(sessions), exportsDir: EXPORTS_DIR });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/sessions', () => {
  it('returns the session summary projection', async () => {
    const response = await request(appWith([makeSession()]))
      .get('/api/sessions/summary')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        sessionId: 'session-1',
        projectName: 'demo',
        provider: 'gemini',
        firstMessage: 'how do I reset the cache?',
      }),
    ]);
  });

  it('returns 404 for an unknown session', async () => {
    const response = await request(appWith([]))
      .get('/api/sessions/does-not-exist')
      .expect(404);

    expect(response.body).toEqual({ error: 'Session not found' });
  });
});

describe('GET /api/user-questions query validation', () => {
  it('rejects a non numeric minScore with 400 and the field name', async () => {
    const response = await request(appWith([makeSession()]))
      .get('/api/user-questions?minScore=abc')
      .expect(400);

    expect(response.body.error).toContain('minScore');
    expect(response.body.field).toBe('minScore');
  });

  it('rejects limit=0 instead of returning everything', async () => {
    const response = await request(appWith([makeSession()]))
      .get('/api/user-questions?limit=0')
      .expect(400);

    expect(response.body.field).toBe('limit');
  });

  it('rejects an unknown category', async () => {
    const response = await request(appWith([makeSession()]))
      .get('/api/user-questions?category=Nope')
      .expect(400);

    expect(response.body.field).toBe('category');
  });

  it('applies limit and reports the unpaginated total', async () => {
    const sessions = [
      makeSession({ sessionId: 'a' }),
      makeSession({ sessionId: 'b' }),
      makeSession({ sessionId: 'c' }),
    ];

    const response = await request(appWith(sessions))
      .get('/api/user-questions?limit=2')
      .expect(200);

    expect(response.body.total).toBe(3);
    expect(response.body.data).toHaveLength(2);
  });

  it('filters by score bounds', async () => {
    const sessions = [
      makeSession({
        sessionId: 'low',
        expressionQuality: { score: 20, ambiguities: [], suggestion: '' },
      }),
      makeSession({
        sessionId: 'high',
        expressionQuality: { score: 90, ambiguities: [], suggestion: '' },
      }),
    ];

    const response = await request(appWith(sessions))
      .get('/api/user-questions?minScore=50')
      .expect(200);

    expect(
      response.body.data.map((s: { sessionId: string }) => s.sessionId),
    ).toEqual(['high']);
  });
});

describe('GET /api/projects', () => {
  it('rejects an invalid provider', async () => {
    const response = await request(appWith([makeSession()]))
      .get('/api/projects?provider=bogus')
      .expect(400);

    expect(response.body.field).toBe('provider');
  });

  it('filters by provider', async () => {
    const sessions = [
      makeSession({ sessionId: 'g1', provider: 'gemini', projectName: 'g' }),
      makeSession({ sessionId: 'c1', provider: 'chatgpt', projectName: 'c' }),
    ];

    const response = await request(appWith(sessions))
      .get('/api/projects?provider=chatgpt')
      .expect(200);

    expect(response.body).toEqual(['c']);
  });
});

describe('prompt rendering', () => {
  it('escapes hostile titles', async () => {
    const session = makeSession({ sessionTitle: 'A & B "quoted"' });

    const response = await request(appWith([session]))
      .get('/api/user-questions?format=prompt')
      .expect(200);

    expect(response.text).toContain('&amp;');
    expect(response.text).toContain('A &amp; B &quot;quoted&quot;');
  });

  it('never emits the literal "undefined..." for a titleless session', async () => {
    const session = makeSession({ sessionTitle: undefined });

    const response = await request(appWith([session]))
      .get('/api/user-questions?format=prompt')
      .expect(200);

    expect(response.text).not.toContain('undefined...');
    expect(response.text).toContain('how do I reset the cache?...');
  });
});

describe('error handling', () => {
  it('returns a generic 500 without leaking internals', async () => {
    const manager = makeManager([]);
    manager.getStats = () => {
      throw new Error('database exploded at /secret/path');
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(
      createApp({ manager, exportsDir: EXPORTS_DIR }),
    )
      .get('/api/stats/summary')
      .expect(500);

    expect(response.body).toEqual({ error: 'Internal Server Error' });
    expect(JSON.stringify(response.body)).not.toContain('/secret/path');
  });
});
