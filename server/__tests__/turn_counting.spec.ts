import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { countMessages, turnStats } from '@chat-analyze/shared';
import { SessionAnalyzer } from '../core/parsing/SessionAnalyzer.js';
import type { AnalyzedSession } from '../types/index.js';

/**
 * The same conversation (one user turn, one assistant turn, one info notice)
 * exported by each provider. `stats.turns` must be provider-independent.
 */
const CONVERSATION = {
  user: 'how do I flush the cache?',
  assistant: 'run FLUSHDB',
  info: 'cache client connected',
};

const createdAt = 1767225600; // 2026-01-01T00:00:00.000Z

function geminiSession() {
  return {
    sessionId: 'turn-gemini',
    projectName: 'demo',
    messages: [
      {
        id: 'u',
        type: 'user',
        content: CONVERSATION.user,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'a',
        type: 'gemini',
        content: CONVERSATION.assistant,
        model: 'gemini-pro',
        timestamp: '2026-01-01T00:00:01.000Z',
      },
      {
        id: 'i',
        type: 'info',
        content: CONVERSATION.info,
        timestamp: '2026-01-01T00:00:02.000Z',
      },
    ],
  };
}

function jsonlSession(): string {
  return [
    JSON.stringify({ sessionId: 'turn-jsonl', projectHash: 'hash' }),
    JSON.stringify({
      id: 'u',
      type: 'user',
      content: [{ text: CONVERSATION.user }],
      timestamp: '2026-01-01T00:00:00.000Z',
    }),
    JSON.stringify({
      id: 'a',
      type: 'gemini',
      content: CONVERSATION.assistant,
      model: 'gemini-pro',
      timestamp: '2026-01-01T00:00:01.000Z',
    }),
    JSON.stringify({
      id: 'i',
      type: 'info',
      content: CONVERSATION.info,
      timestamp: '2026-01-01T00:00:02.000Z',
    }),
  ].join('\n');
}

function chatGptSession() {
  return {
    id: 'turn-chatgpt',
    title: 'Cache flush',
    current_node: 'n3',
    mapping: {
      n1: {
        id: 'n1',
        parent: null,
        message: {
          id: 'm1',
          author: { role: 'user' },
          content: { parts: [CONVERSATION.user] },
          create_time: createdAt,
        },
      },
      n2: {
        id: 'n2',
        parent: 'n1',
        message: {
          id: 'm2',
          author: { role: 'assistant' },
          content: { parts: [CONVERSATION.assistant] },
          create_time: createdAt + 1,
        },
      },
      n3: {
        id: 'n3',
        parent: 'n2',
        message: {
          id: 'm3',
          author: { role: 'system' },
          content: { parts: [CONVERSATION.info] },
          create_time: createdAt + 2,
        },
      },
    },
  };
}

describe('countMessages / turnStats', () => {
  it('counts turns as user + assistant only', () => {
    const messages = [
      { type: 'user' as const },
      { type: 'assistant' as const },
      { type: 'system' as const },
      { type: 'info' as const },
    ];

    expect(countMessages(messages)).toEqual({
      user: 1,
      assistant: 1,
      system: 1,
      info: 1,
      total: 4,
      turns: 2,
    });
    expect(turnStats(messages)).toEqual({
      turns: 2,
      totalMessages: 4,
      userTurns: 1,
      assistantTurns: 1,
    });
  });

  it('handles an empty transcript', () => {
    expect(turnStats([])).toEqual({
      turns: 0,
      totalMessages: 0,
      userTurns: 0,
      assistantTurns: 0,
    });
  });
});

describe('turns are consistent across providers', () => {
  const analyzer = new SessionAnalyzer();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-analyze-turns-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function analyzeFile(name: string, content: string) {
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, content);
    const result = await analyzer.analyze(filePath);
    expect(result.warnings).toEqual([]);
    expect(result.sessions).toHaveLength(1);
    return result.sessions[0];
  }

  it('produces identical turn stats for Gemini JSON, JSONL and ChatGPT', async () => {
    const sessions: Record<string, AnalyzedSession> = {
      gemini: await analyzeFile(
        'gemini-session.json',
        JSON.stringify(geminiSession()),
      ),
      jsonl: await analyzeFile('session.jsonl', jsonlSession()),
      chatgpt: await analyzeFile(
        'chatgpt-export.json',
        JSON.stringify(chatGptSession()),
      ),
    };

    for (const [provider, session] of Object.entries(sessions)) {
      expect(session.stats, provider).toMatchObject({
        turns: 2,
        totalMessages: 3,
        userTurns: 1,
        assistantTurns: 1,
        geminiTurns: 1,
      });
      expect(session.stats.turns, provider).toBe(
        session.stats.userTurns + session.stats.assistantTurns,
      );
      expect(
        session.messages.filter((m) => m.type === 'assistant'),
        provider,
      ).toHaveLength(1);
    }
  });

  it('maps the provider-specific roles onto user / assistant / info', async () => {
    const gemini = await analyzeFile(
      'gemini-session.json',
      JSON.stringify(geminiSession()),
    );
    const chatgpt = await analyzeFile(
      'chatgpt-export.json',
      JSON.stringify(chatGptSession()),
    );

    expect(gemini.messages.map((m) => m.type)).toEqual([
      'user',
      'assistant',
      'info',
    ]);
    expect(chatgpt.messages.map((m) => m.type)).toEqual([
      'user',
      'info',
      'assistant',
    ]);
  });

  it('keeps checkpoint model turns as assistant', async () => {
    const checkpoint = await analyzeFile(
      'checkpoint-cache.json',
      JSON.stringify({
        history: [
          { role: 'user', parts: [{ text: CONVERSATION.user }] },
          { role: 'model', parts: [{ text: CONVERSATION.assistant }] },
        ],
      }),
    );

    expect(checkpoint.messages.map((m) => m.type)).toEqual([
      'user',
      'assistant',
    ]);
    expect(checkpoint.stats).toMatchObject({
      turns: 2,
      totalMessages: 2,
      userTurns: 1,
      assistantTurns: 1,
    });
  });
});
