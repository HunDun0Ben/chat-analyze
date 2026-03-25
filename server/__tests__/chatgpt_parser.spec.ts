/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - ChatGPT Parser Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { SessionParser } from '../core/parser.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

describe('SessionParser (ChatGPT Unification)', () => {
  const parser = new SessionParser();

  it('should unify fragmented ChatGPT nodes into a single structured message', async () => {
    const tempDir = path.join(os.tmpdir(), 'chat-analyze-chatgpt-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    const mockChatGPT = {
      id: "conv-123",
      title: "Deep Unification Test",
      current_node: "node-5",
      mapping: {
        "node-1": {
          id: "node-1",
          parent: null,
          message: {
            id: "msg-1",
            author: { role: "user" },
            content: { parts: ["Search for ApsaraMQ for Kafka"] },
            create_time: 1711353600
          }
        },
        "node-2": {
          id: "node-2",
          parent: "node-1",
          message: {
            id: "msg-2",
            author: { role: "assistant" },
            recipient: "thought",
            content: { parts: ["I need to search for ApsaraMQ for Kafka."] },
            create_time: 1711353601
          }
        },
        "node-3": {
          id: "node-3",
          parent: "node-2",
          message: {
            id: "msg-3",
            author: { role: "assistant" },
            recipient: "browser",
            content: { content_type: "code", text: "search(\"ApsaraMQ for Kafka\")" },
            create_time: 1711353602
          }
        },
        "node-4": {
          id: "node-4",
          parent: "node-3",
          message: {
            id: "msg-4",
            author: { role: "tool" },
            content: { text: "ApsaraMQ for Kafka is a fully managed message queue service." },
            create_time: 1711353603
          }
        },
        "node-5": {
          id: "node-5",
          parent: "node-4",
          message: {
            id: "msg-5",
            author: { role: "assistant" },
            content: { parts: ["Here is what I found: ApsaraMQ for Kafka is a managed service."] },
            create_time: 1711353604,
            metadata: { model_slug: "gpt-4" }
          }
        }
      }
    };

    const filePath = path.join(tempDir, 'chatgpt-test.json');
    await fs.writeFile(filePath, JSON.stringify(mockChatGPT));

    const result = await parser.analyze(filePath);

    // Verify aggregation
    expect(result.messages.length).toBe(2); // One user, one assistant (unified)
    
    const assistantMsg = result.messages[1];
    expect(assistantMsg.type).toBe('gemini');
    expect(assistantMsg.content).toContain("Here is what I found");
    
    // Check thoughts
    expect(assistantMsg.thoughts?.length).toBe(1);
    expect(assistantMsg.thoughts?.[0].description).toBe("I need to search for ApsaraMQ for Kafka.");
    
    // Check tool calls
    expect(assistantMsg.toolCalls?.length).toBe(1);
    expect(assistantMsg.toolCalls?.[0].name).toBe("search");
    expect(assistantMsg.toolCalls?.[0].args.code).toBe("search(\"ApsaraMQ for Kafka\")");
    expect(assistantMsg.toolCalls?.[0].result).toContain("fully managed message queue service");
    expect(assistantMsg.toolCalls?.[0].status).toBe("success");

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle multiple user turns correctly', async () => {
    const tempDir = path.join(os.tmpdir(), 'chat-analyze-chatgpt-multi-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    const mockChatGPT = {
      id: "conv-456",
      title: "Multi Turn Test",
      current_node: "node-u2",
      mapping: {
        "node-u1": {
          id: "node-u1",
          parent: null,
          message: {
            author: { role: "user" },
            content: { parts: ["Hi"] },
            create_time: 1711353600
          }
        },
        "node-a1": {
          id: "node-a1",
          parent: "node-u1",
          message: {
            author: { role: "assistant" },
            content: { parts: ["Hello!"] },
            create_time: 1711353601
          }
        },
        "node-u2": {
          id: "node-u2",
          parent: "node-a1",
          message: {
            author: { role: "user" },
            content: { parts: ["How are you?"] },
            create_time: 1711353602
          }
        }
      }
    };

    const filePath = path.join(tempDir, 'chatgpt-multi.json');
    await fs.writeFile(filePath, JSON.stringify(mockChatGPT));

    const result = await parser.analyze(filePath);
    expect(result.messages.length).toBe(3);
    expect(result.messages[0].type).toBe('user');
    expect(result.messages[1].type).toBe('gemini');
    expect(result.messages[2].type).toBe('user');

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
