/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Parser Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionParser } from '../core/parser.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

describe('SessionParser (Spec)', () => {
  const parser = new SessionParser();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'chat-analyze-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('Scenario 1: Long Hash in JSON, Project Name in Path', async () => {
    const projectDir = path.join(tempDir, 'my-cool-project', 'chats');
    await fs.mkdir(projectDir, { recursive: true });
    
    const mockSession = {
      sessionId: "test-session-123",
      projectName: "5115626aaecb2deb1d2108b6f2f0732be44e3296709a32362fc9457208251a6f",
      projectHash: "5115626aaecb2deb1d2108b6f2f0732be44e3296709a32362fc9457208251a6f",
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      messages: [
        { id: "1", type: "user", content: "Hello", timestamp: Date.now() },
        { id: "2", type: "gemini", content: "Hi", timestamp: Date.now(), model: "gemini-1.5-pro" }
      ]
    };

    const filePath = path.join(projectDir, 'session-test.json');
    await fs.writeFile(filePath, JSON.stringify(mockSession));

    const result = await parser.analyze(filePath);
    expect(result.projectName).toBe("my-cool-project");
  });

  it('Scenario 2: Normal Project Name in JSON', async () => {
    const projectDir = path.join(tempDir, 'my-cool-project', 'chats');
    await fs.mkdir(projectDir, { recursive: true });

    const mockSession = {
      sessionId: "test-2",
      projectName: "CustomName",
      projectHash: "5115626aaecb2deb1d2108b6f2f0732be44e3296709a32362fc9457208251a6f",
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      messages: []
    };
    const filePath = path.join(projectDir, 'session-test-2.json');
    await fs.writeFile(filePath, JSON.stringify(mockSession));

    const result = await parser.analyze(filePath);
    expect(result.projectName).toBe("CustomName");
  });

  it('Scenario 3: No "chats" directory in path', async () => {
    const simpleProjectDir = path.join(tempDir, 'simple-project');
    await fs.mkdir(simpleProjectDir, { recursive: true });
    
    const mockSession = {
      sessionId: "test-session-3",
      projectName: "0000000000000000000000000000000000000000000000000000000000000000",
      projectHash: "0000000000000000000000000000000000000000000000000000000000000000",
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      messages: []
    };
    const filePath = path.join(simpleProjectDir, 'session-test-3.json');
    await fs.writeFile(filePath, JSON.stringify(mockSession));

    const result = await parser.analyze(filePath);
    expect(result.projectName).toBe("simple-project");
  });
});
