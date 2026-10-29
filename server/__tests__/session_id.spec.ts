import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionAnalyzer } from '../core/parsing/SessionAnalyzer.js';
import { SessionManager } from '../core/manager.js';
import { SessionStorage } from '../db/storage.js';
import { DiscoveryService } from '../core/services/DiscoveryService.js';
import { ProjectResolver } from '../core/services/ProjectResolver.js';
import { stableSessionId } from '../core/parsing/shared/ids.js';

function geminiSession(id?: string) {
  return {
    ...(id ? { sessionId: id } : {}),
    projectName: 'demo',
    startTime: '2026-01-01T00:00:00.000Z',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    messages: [
      {
        id: 'm1',
        type: 'user',
        content: 'hello',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

describe('session id resolution', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-analyze-ids-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('keeps two id-less sessions in one directory apart', async () => {
    await fs.writeFile(
      path.join(tempDir, 'session-a.json'),
      JSON.stringify(geminiSession()),
    );
    await fs.writeFile(
      path.join(tempDir, 'session-b.json'),
      JSON.stringify(geminiSession()),
    );

    const manager = new SessionManager(
      [tempDir],
      new SessionAnalyzer(),
      new SessionStorage(':memory:'),
      new DiscoveryService(),
      new ProjectResolver(),
    );

    await manager.init();

    const sessions = manager.getAllSessions();
    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((s) => s.sessionId)).size).toBe(2);
    expect(sessions.every((s) => s.sessionId.length > 0)).toBe(true);
  });

  it('derives the same id for the same file across parses', async () => {
    const filePath = path.join(tempDir, 'checkpoint-demo.json');
    await fs.writeFile(
      filePath,
      JSON.stringify({
        history: [
          { role: 'user', parts: [{ text: 'hi' }] },
          { role: 'model', parts: [{ text: 'hello' }] },
        ],
      }),
    );

    const parser = new SessionAnalyzer();
    const first = await parser.analyze(filePath);
    const second = await parser.analyze(filePath);

    expect(first.sessions[0].sessionId).toBe(second.sessions[0].sessionId);
    expect(first.sessions[0].sessionId).toBe(stableSessionId(filePath));
  });

  it('falls back to the conversation id of a ChatGPT export entry', async () => {
    const filePath = path.join(tempDir, 'chatgpt.json');
    await fs.writeFile(
      filePath,
      JSON.stringify({
        conversation_id: 'conv-42',
        title: 'Demo',
        current_node: 'n2',
        mapping: {
          n1: {
            parent: null,
            message: {
              id: 'n1',
              author: { role: 'user' },
              content: { parts: ['hello'] },
              create_time: 1711353600,
            },
          },
          n2: {
            parent: 'n1',
            message: {
              id: 'n2',
              author: { role: 'assistant' },
              content: { parts: ['hi'] },
              create_time: 1711353601,
            },
          },
        },
      }),
    );

    const result = await new SessionAnalyzer().analyze(filePath);

    expect(result.sessions[0].sessionId).toBe('conv-42');
  });
});
