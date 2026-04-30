import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionParser } from '../core/parser.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

describe('GeminiJsonlParser (Integration)', () => {
  const parser = new SessionParser();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'chat-analyze-jsonl-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should correctly parse a .jsonl session with metadata, messages, and $set updates', async () => {
    const filePath = path.join(tempDir, 'session-test.jsonl');
    
    const lines = [
      // 1. Metadata
      JSON.stringify({
        sessionId: 'jsonl-123',
        projectHash: 'hash-abc',
        startTime: '2026-04-29T10:00:00.000Z',
        lastUpdated: '2026-04-29T10:00:00.000Z',
        kind: 'main'
      }),
      // 2. Info event
      JSON.stringify({
        id: 'msg-info',
        timestamp: '2026-04-29T10:00:01.000Z',
        type: 'info',
        content: 'System started'
      }),
      // 3. User message
      JSON.stringify({
        id: 'msg-user-1',
        timestamp: '2026-04-29T10:01:00.000Z',
        type: 'user',
        content: [{ text: 'How are you?' }]
      }),
      // 4. $set update
      JSON.stringify({
        $set: { lastUpdated: '2026-04-29T10:01:00.000Z' }
      }),
      // 5. Gemini message
      JSON.stringify({
        id: 'msg-gemini-1',
        timestamp: '2026-04-29T10:01:10.000Z',
        type: 'gemini',
        content: 'I am doing well, thank you!',
        model: 'gemini-2.0-flash',
        thoughts: [{ subject: 'Greeting', description: 'User asked how I am.' }],
        tokens: { input: 10, output: 20, total: 30, thoughts: 5, cached: 0 }
      }),
      // 6. $set update
      JSON.stringify({
        $set: { lastUpdated: '2026-04-29T10:01:10.000Z' }
      })
    ];

    await fs.writeFile(filePath, lines.join('\n'));

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');

    // Verify metadata
    expect(result.sessionId).toBe('jsonl-123');
    expect(result.projectHash).toBe('hash-abc');
    expect(result.startTime).toBe('2026-04-29T10:00:00.000Z');
    expect(result.lastUpdated).toBe('2026-04-29T10:01:10.000Z');
    expect(result.modelId).toBe('gemini-2.0-flash'); // Test the modelId fix

    // Verify messages
    expect(result.messages.length).toBe(3); // info + user + gemini
    expect(result.messages[0].type).toBe('info');
    expect(result.messages[1].type).toBe('user');
    expect(result.messages[1].content).toBe('How are you?');
    expect(result.messages[2].type).toBe('gemini');
    expect(result.messages[2].model).toBe('gemini-2.0-flash');
    expect(result.messages[2].thoughts?.length).toBe(1);

    // Verify stats
    expect(result.stats.userTurns).toBe(1);
    expect(result.stats.geminiTurns).toBe(1);
    expect(result.stats.tokenUsage.total).toBe(30);
  });

  it('should handle malformed lines gracefully', async () => {
    const filePath = path.join(tempDir, 'session-malformed.jsonl');
    const lines = [
      JSON.stringify({ sessionId: 'malformed-test' }),
      'invalid json here',
      JSON.stringify({ id: 'msg-1', type: 'user', content: [{ text: 'Valid' }], timestamp: '...' })
    ];
    await fs.writeFile(filePath, lines.join('\n'));

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');
    
    expect(result.sessionId).toBe('malformed-test');
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].content).toBe('Valid');
  });
});
