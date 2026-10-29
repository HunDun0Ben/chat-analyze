import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionManager, SessionAnalyzerLike } from '../core/manager.js';
import { MAX_CONCURRENT_PARSES } from '../core/manager.js';
import { DiscoveryService } from '../core/services/DiscoveryService.js';
import { ProjectResolver } from '../core/services/ProjectResolver.js';
import { ParseResult } from '../core/parsing/result.js';
import { AnalyzedSession } from '../types/index.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class CountingAnalyzer implements SessionAnalyzerLike {
  calls = 0;
  active = 0;
  maxActive = 0;

  async analyze(filePath: string): Promise<ParseResult> {
    this.calls++;
    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);
    await sleep(5);
    this.active--;

    const session: AnalyzedSession = {
      sessionId: `id-${path.basename(filePath)}`,
      projectName: 'Imported',
      projectNameIsPlaceholder: true,
      projectHash: '',
      modelId: 'test',
      category: 'General',
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
        totalMessages: 2,
        userTurns: 1,
        assistantTurns: 1,
        geminiTurns: 1,
        corrections: 0,
        toolChain: [],
        tokenUsage: { input: 1, output: 1, thoughts: 0, total: 2 },
      },
      messages: [],
      filePath,
    };

    return { sessions: [session], warnings: [] };
  }
}

describe('SessionManager sync behaviour', () => {
  let tempDir: string;
  let analyzer: CountingAnalyzer;
  let manager: SessionManager;

  async function writeSession(name: string): Promise<string> {
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, JSON.stringify({ messages: [] }));
    return filePath;
  }

  function makeManager(watchPaths: string[] = [tempDir]): SessionManager {
    return new SessionManager(
      watchPaths,
      analyzer,
      null, // persistence disabled
      new DiscoveryService(),
      new ProjectResolver(),
    );
  }

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-analyze-sync-'));
    analyzer = new CountingAnalyzer();
    manager = makeManager();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('bounds concurrent parses', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        writeSession(`session-${index}.json`),
      ),
    );

    await manager.init();

    expect(analyzer.calls).toBe(20);
    expect(analyzer.maxActive).toBeLessThanOrEqual(MAX_CONCURRENT_PARSES);
  });

  it('skips unchanged files on a second init in the same process', async () => {
    await writeSession('a.json');
    await writeSession('b.json');

    await manager.init();
    expect(analyzer.calls).toBe(2);

    await manager.init();
    expect(analyzer.calls).toBe(2);
    expect(manager.getAllSessions()).toHaveLength(2);
  });

  it('re-parses files whose mtime changed', async () => {
    const filePath = await writeSession('a.json');

    await manager.init();
    expect(analyzer.calls).toBe(1);

    await sleep(10);
    await fs.writeFile(filePath, JSON.stringify({ messages: [], extra: 1 }));
    await manager.init();

    expect(analyzer.calls).toBe(2);
  });

  it('drops sessions whose file disappeared before the next init', async () => {
    const filePath = await writeSession('a.json');
    await writeSession('b.json');

    await manager.init();
    expect(manager.getAllSessions()).toHaveLength(2);

    await fs.rm(filePath);
    await manager.init();

    expect(manager.getAllSessions()).toHaveLength(1);
    expect(manager.getSession('id-a.json')).toBeNull();
  });

  it('removes a session immediately when the watcher reports a deletion', async () => {
    const filePath = await writeSession('a.json');
    await manager.init();
    expect(manager.getSession('id-a.json')).not.toBeNull();

    await fs.rm(filePath);
    manager.removeByPath(filePath);

    expect(manager.getSession('id-a.json')).toBeNull();
    expect(manager.getAllSessions()).toEqual([]);
  });
});
