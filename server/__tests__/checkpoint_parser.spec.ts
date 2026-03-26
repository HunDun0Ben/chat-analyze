/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Gemini Checkpoint Parser Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { GeminiCheckpointParser } from '../core/parsers/GeminiCheckpointParser.js';
import { CoachService } from '../core/services/CoachService.js';

describe('GeminiCheckpointParser', () => {
  const coachService = new CoachService();
  const parser = new GeminiCheckpointParser(coachService);

  const mockCheckpoint = {
    "history": [
      {
        "role": "user",
        "parts": [
          { "text": "帮我切换到任意一个 7.x 版本" }
        ]
      },
      {
        "role": "model",
        "parts": [
          {
            "text": "**Listing the Available Versions**",
            "thought": true
          },
          {
            "text": "我将先列出项目中的所有标签（tags）"
          },
          {
            "functionCall": {
              "name": "run_shell_command",
              "args": { "command": "git tag -l \"7.*\"" },
              "id": "run_shell_command_1"
            }
          }
        ]
      },
      {
        "role": "user",
        "parts": [
          {
            "functionResponse": {
              "id": "run_shell_command_1",
              "name": "run_shell_command",
              "response": { "output": "7.4.8" }
            }
          }
        ]
      }
    ]
  };

  it('should correctly parse history into session messages', async () => {
    const result = await parser.analyze(mockCheckpoint, {
      filePath: '/path/to/checkpoint-redis.json',
      fileName: 'checkpoint-redis'
    });

    expect(result.projectName).toBe('redis');
    expect(result.messages.length).toBe(3);
    
    // User message
    expect(result.messages[0].type).toBe('user');
    expect(result.messages[0].content).toBe('帮我切换到任意一个 7.x 版本');

    // Model message with thought and tool call
    expect(result.messages[1].type).toBe('gemini');
    expect(result.messages[1].content).toContain('我将先列出项目中的所有标签');
    expect(result.messages[1].thoughts?.length).toBe(1);
    expect(result.messages[1].toolCalls?.length).toBe(1);
    expect(result.messages[1].toolCalls?.[0].name).toBe('run_shell_command');

    // Function response message (parsed as user message with tool results)
    expect(result.messages[2].type).toBe('user');
    expect(result.messages[2].toolCalls?.[0].status).toBe('success');
    expect(result.messages[2].toolCalls?.[0].result).toEqual({ output: '7.4.8' });
  });

  it('should extract project name from filename correctly', async () => {
    const cases = [
      { fileName: 'checkpoint-%22redis%20base%20dir%22', expected: 'redis' },
      { fileName: 'checkpoint-my_project', expected: 'my' }, // "my" is short, but the parser merges? wait, currently "my" is 2 chars, will return "my-project"
      { fileName: 'checkpoint-%22A-B%22', expected: 'A-B' },
      { fileName: 'checkpoint-%E7%BE%8E%E5%9B%A2', expected: '美团' }
    ];

    for (const testCase of cases) {
      const result = await parser.analyze({ history: [] }, {
        filePath: `/tmp/${testCase.fileName}.json`,
        fileName: testCase.fileName
      });
      expect(result.projectName).toBe(testCase.expected);
    }
  });
});
