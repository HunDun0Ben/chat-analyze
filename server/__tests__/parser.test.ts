/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Parser Unit Tests (Vitest)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionParser } from '../core/parser.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

describe('SessionParser', () => {
  const parser = new SessionParser();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'chat-analyze-vitest-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should extract project name from parent directory when internal name is a long hash', async () => {
    // 模拟包含长哈希项目名的 JSON
    const projectDir = path.join(tempDir, 'my-cool-project', 'chats');
    await fs.mkdir(projectDir, { recursive: true });
    
    const mockSession = {
      sessionId: "test-session-1",
      projectName: "5115626aaecb2deb1d2108b6f2f0732be44e3296709a32362fc9457208251a6f",
      projectHash: "5115626aaecb2deb1d2108b6f2f0732be44e3296709a32362fc9457208251a6f",
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      messages: [
        { id: "1", type: "user", content: "Hello", timestamp: Date.now() },
        { id: "2", type: "gemini", content: "Hi", timestamp: Date.now(), model: "gemini-1.5-pro" }
      ]
    };

    const filePath = path.join(projectDir, 'session-1.json');
    await fs.writeFile(filePath, JSON.stringify(mockSession));

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');
    expect(result.projectName).toBe('my-cool-project');
  });

  it('should prefer internal project name when it is NOT a long hash', async () => {
    const projectDir = path.join(tempDir, 'ignore-this-dir', 'chats');
    await fs.mkdir(projectDir, { recursive: true });
    
    const mockSession = {
      sessionId: "test-session-2",
      projectName: "ValidProjectName",
      projectHash: "some-hash",
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      messages: []
    };

    const filePath = path.join(projectDir, 'session-2.json');
    await fs.writeFile(filePath, JSON.stringify(mockSession));

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');
    expect(result.projectName).toBe('ValidProjectName');
  });

  it('should correctly handle paths without "chats" subdirectory', async () => {
    const projectDir = path.join(tempDir, 'simple-dir');
    await fs.mkdir(projectDir, { recursive: true });
    
    const mockSession = {
      sessionId: "test-session-3",
      projectName: "0000000000000000000000000000000000000000000000000000000000000000",
      projectHash: "0000000000000000000000000000000000000000000000000000000000000000",
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      messages: []
    };

    const filePath = path.join(projectDir, 'session-3.json');
    await fs.writeFile(filePath, JSON.stringify(mockSession));

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');
    expect(result.projectName).toBe('simple-dir');
  });
});
