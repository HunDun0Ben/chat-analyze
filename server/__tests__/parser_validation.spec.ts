import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionAnalyzer } from '../core/parsing/SessionAnalyzer.js';

const analyzer = new SessionAnalyzer();

describe('parser payload validation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-analyze-schema-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function write(name: string, content: unknown): Promise<string> {
    const filePath = path.join(tempDir, name);
    await fs.writeFile(
      filePath,
      typeof content === 'string' ? content : JSON.stringify(content),
    );
    return filePath;
  }

  it('rejects a Gemini session whose messages is not an array', async () => {
    const filePath = await write('gemini-broken.json', {
      sessionId: 'x',
      messages: 'not-an-array',
    });

    const result = await analyzer.analyze(filePath);

    expect(result.sessions).toEqual([]);
    expect(result.warnings[0].reason).toContain('messages');
  });

  it('keeps unknown Gemini fields thanks to passthrough', async () => {
    const filePath = await write('gemini-extra.json', {
      sessionId: 'extra-1',
      futureField: { anything: true },
      messages: [{ id: 'm1', type: 'user', content: 'hi' }],
    });

    const result = await analyzer.analyze(filePath);

    expect(result.warnings).toEqual([]);
    expect(result.sessions[0].sessionId).toBe('extra-1');
  });

  it('normalises numeric Gemini timestamps', async () => {
    const filePath = await write('gemini-number-ts.json', {
      sessionId: 'num-1',
      messages: [
        { id: 'm1', type: 'user', content: 'hi', timestamp: 1711353600000 },
      ],
    });

    const result = await analyzer.analyze(filePath);

    expect(result.sessions[0].messages[0].timestamp).toBe(
      new Date(1711353600000).toISOString(),
    );
  });

  it('rejects a ChatGPT export whose mapping is not an object', async () => {
    const filePath = await write('chatgpt-broken.json', {
      id: 'conv-1',
      mapping: 'nope',
    });

    const result = await analyzer.analyze(filePath);

    expect(result.sessions).toEqual([]);
    expect(result.warnings[0].reason).toContain('mapping');
  });

  it('accepts null create_time in a ChatGPT export', async () => {
    const filePath = await write('chatgpt-null-time.json', {
      id: 'conv-null',
      current_node: 'n1',
      create_time: null,
      update_time: null,
      mapping: {
        n1: {
          parent: null,
          message: {
            id: 'n1',
            author: { role: 'user' },
            content: { parts: ['hi'] },
            create_time: null,
          },
        },
      },
    });

    const result = await analyzer.analyze(filePath);

    expect(result.warnings).toEqual([]);
    expect(result.sessions[0].messages).toHaveLength(1);
  });

  it('defaults missing checkpoint parts to an empty list', async () => {
    const filePath = await write('checkpoint-no-parts.json', {
      history: [{ role: 'user' }],
    });

    const result = await analyzer.analyze(filePath);

    expect(result.warnings).toEqual([]);
    expect(result.sessions[0].messages[0].content).toBe('');
  });

  it('rejects a checkpoint whose parts is not an array', async () => {
    const filePath = await write('checkpoint-broken.json', {
      history: [{ role: 'user', parts: 'nope' }],
    });

    const result = await analyzer.analyze(filePath);

    expect(result.sessions).toEqual([]);
    expect(result.warnings[0].reason).toContain('parts');
  });

  it('skips a JSONL turn with an invalid content shape but keeps later lines', async () => {
    const filePath = await write(
      'jsonl-invalid-turn.jsonl',
      [
        JSON.stringify({ sessionId: 'jsonl-invalid' }),
        JSON.stringify({
          id: 'bad',
          type: 'user',
          content: 42,
          timestamp: '2026-01-01T00:00:00.000Z',
        }),
        JSON.stringify({
          id: 'good',
          type: 'user',
          content: [{ text: 'kept' }],
          timestamp: '2026-01-01T00:00:01.000Z',
        }),
      ].join('\n'),
    );

    const result = await analyzer.analyze(filePath);

    expect(result.sessions[0].messages).toHaveLength(1);
    expect(result.sessions[0].messages[0].content).toBe('kept');
    expect(result.warnings[0].reason).toContain('line 2');
  });
});
