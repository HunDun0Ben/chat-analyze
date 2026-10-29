import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionAnalyzer } from '../core/parsing/SessionAnalyzer.js';
import { PARSER_REGISTRATIONS } from '../core/parsing/registry.js';
import { SessionManager } from '../core/manager.js';
import { SessionStorage } from '../db/storage.js';
import { DiscoveryService } from '../core/services/DiscoveryService.js';
import { ProjectResolver } from '../core/services/ProjectResolver.js';

const HASH = 'a'.repeat(64);

describe('parser registry', () => {
  const analyzer = new SessionAnalyzer();

  it('registers the ChatGPT probe before the generic Gemini probe', () => {
    const payload = { mapping: {}, conversation_id: 'c1', messages: [] };
    const matched = PARSER_REGISTRATIONS.filter((entry) =>
      entry.canParse(payload),
    );

    expect(matched.map((entry) => entry.format)).toEqual([
      'chatgpt-export',
      'gemini-session',
    ]);
  });

  it('reports an unsupported payload instead of guessing a provider', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-analyze-reg-'));
    const filePath = path.join(dir, 'unknown.json');
    await fs.writeFile(filePath, JSON.stringify({ something: 'else' }));

    const result = await analyzer.analyze(filePath);
    await fs.rm(dir, { recursive: true, force: true });

    expect(result.sessions).toEqual([]);
    expect(result.warnings[0].reason).toContain('Unsupported session format');
  });
});

describe('project name placeholders', () => {
  const resolver = new ProjectResolver();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-analyze-naming-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('treats known placeholder names as needing resolution', () => {
    expect(resolver.isPlaceholder('gemini', 'Unknown')).toBe(true);
    expect(resolver.isPlaceholder('gemini', 'Imported')).toBe(true);
    expect(resolver.isPlaceholder('gemini', HASH)).toBe(true);
    expect(resolver.isPlaceholder('gemini', 'my-project')).toBe(false);

    expect(resolver.isPlaceholder('chatgpt', 'ChatGPT Import')).toBe(true);
    expect(resolver.isPlaceholder('chatgpt', 'my-project')).toBe(false);
  });

  async function initManager(): Promise<SessionManager> {
    const manager = new SessionManager(
      [tempDir],
      new SessionAnalyzer(),
      new SessionStorage(':memory:'),
      new DiscoveryService(),
      new ProjectResolver(),
    );
    await manager.init();
    return manager;
  }

  it('keeps a payload project literally named "Unknown"', async () => {
    const projectDir = path.join(tempDir, 'real-dir');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'session.json'),
      JSON.stringify({
        sessionId: 'literal-unknown',
        projectName: 'Unknown',
        messages: [{ id: 'm1', type: 'user', content: 'hi' }],
      }),
    );

    const manager = await initManager();

    expect(manager.getSession('literal-unknown')?.projectName).toBe('Unknown');
  });

  it('replaces a 64-hex project hash with the directory name', async () => {
    const projectDir = path.join(tempDir, 'hash-project');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'session.json'),
      JSON.stringify({
        sessionId: 'hash-session',
        projectName: HASH,
        projectHash: HASH,
        messages: [{ id: 'm1', type: 'user', content: 'hi' }],
      }),
    );

    const manager = await initManager();

    expect(manager.getSession('hash-session')?.projectName).toBe(
      'hash-project',
    );
  });

  it('resolves the JSONL default project name from the path', async () => {
    const projectDir = path.join(tempDir, 'jsonl-project');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'session.jsonl'),
      [
        JSON.stringify({ sessionId: 'jsonl-naming' }),
        JSON.stringify({
          id: 'u1',
          type: 'user',
          timestamp: '2026-01-01T00:00:00.000Z',
          content: [{ text: 'hi' }],
        }),
      ].join('\n'),
    );

    const manager = await initManager();

    expect(manager.getSession('jsonl-naming')?.projectName).toBe(
      'jsonl-project',
    );
  });
});
