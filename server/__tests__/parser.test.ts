import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionParser } from '../core/parser.js';
import { ProjectResolver } from '../core/services/ProjectResolver.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

describe('SessionParser', () => {
  const parser = new SessionParser();
  const projectResolver = new ProjectResolver();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'chat-analyze-vitest-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should leave a long hash for ProjectResolver to replace with the path name', async () => {
    const projectDir = path.join(tempDir, 'my-cool-project', 'chats');
    await fs.mkdir(projectDir, { recursive: true });

    const hash =
      '5115626aaecb2deb1d2108b6f2f0732be44e3296709a32362fc9457208251a6f';
    const mockSession = {
      sessionId: 'test-session-1',
      projectName: hash,
      projectHash: hash,
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      messages: [
        { id: '1', type: 'user', content: 'Hello', timestamp: Date.now() },
        {
          id: '2',
          type: 'gemini',
          content: 'Hi',
          timestamp: Date.now(),
          model: 'gemini-1.5-pro',
        },
      ],
    };

    const filePath = path.join(projectDir, 'session-1.json');
    await fs.writeFile(filePath, JSON.stringify(mockSession));

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');

    expect(result.projectName).toBe(hash);
    expect(await projectResolver.resolve('gemini', filePath, [tempDir])).toBe(
      'my-cool-project',
    );
  });

  it('should prefer internal project name when it is NOT a long hash', async () => {
    const projectDir = path.join(tempDir, 'ignore-this-dir', 'chats');
    await fs.mkdir(projectDir, { recursive: true });

    const mockSession = {
      sessionId: 'test-session-2',
      projectName: 'ValidProjectName',
      projectHash: 'some-hash',
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      messages: [],
    };

    const filePath = path.join(projectDir, 'session-2.json');
    await fs.writeFile(filePath, JSON.stringify(mockSession));

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');
    expect(result.projectName).toBe('ValidProjectName');
  });

  it('should resolve paths without a "chats" subdirectory', async () => {
    const projectDir = path.join(tempDir, 'simple-dir');
    await fs.mkdir(projectDir, { recursive: true });

    const hash =
      '0000000000000000000000000000000000000000000000000000000000000000';
    const mockSession = {
      sessionId: 'test-session-3',
      projectName: hash,
      projectHash: hash,
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      messages: [],
    };

    const filePath = path.join(projectDir, 'session-3.json');
    await fs.writeFile(filePath, JSON.stringify(mockSession));

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');
    expect(result.projectName).toBe(hash);
    expect(await projectResolver.resolve('gemini', filePath, [tempDir])).toBe(
      'simple-dir',
    );
  });
});
