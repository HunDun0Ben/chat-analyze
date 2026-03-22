/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Parser Unit Tests
 */

import { SessionParser } from '../parser.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import assert from 'node:assert';

async function runTests() {
  const parser = new SessionParser();
  const tempDir = path.join(os.tmpdir(), 'chat-analyze-test-' + Date.now());
  
  console.log(`[Test] Setting up temp environment: ${tempDir}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // 准备测试场景 1: 内容包含长哈希，路径包含项目名 'my-cool-project'
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

    console.log("[Test] Scenario 1: Long Hash in JSON, Project Name in Path");
    const result1 = await parser.analyze(filePath);
    console.log(`  - Detected Project Name: ${result1.projectName}`);
    assert.strictEqual(result1.projectName, "my-cool-project", "Should extract project name from parent directory");

    // 准备测试场景 2: 内容包含正常的项目名，应优先使用
    const mockSession2 = { ...mockSession, projectName: "CustomName", sessionId: "test-2" };
    const filePath2 = path.join(projectDir, 'session-test-2.json');
    await fs.writeFile(filePath2, JSON.stringify(mockSession2));

    console.log("[Test] Scenario 2: Normal Project Name in JSON");
    const result2 = await parser.analyze(filePath2);
    console.log(`  - Detected Project Name: ${result2.projectName}`);
    assert.strictEqual(result2.projectName, "CustomName", "Should prefer internal project name if it is not a hash");

    // 准备测试场景 3: 路径中没有 'chats' 目录的情况
    const simpleProjectDir = path.join(tempDir, 'simple-project');
    await fs.mkdir(simpleProjectDir, { recursive: true });
    const filePath3 = path.join(simpleProjectDir, 'session-test-3.json');
    await fs.writeFile(filePath3, JSON.stringify(mockSession)); // 再次使用哈希内容

    console.log("[Test] Scenario 3: No 'chats' directory in path");
    const result3 = await parser.analyze(filePath3);
    console.log(`  - Detected Project Name: ${result3.projectName}`);
    assert.strictEqual(result3.projectName, "simple-project", "Should fallback to immediate parent directory");

    console.log("\n[Success] All SessionParser unit tests passed!");

  } catch (err) {
    console.error("\n[Failed] Test failed:", err);
    process.exit(1);
  } finally {
    // 清理
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

runTests();
