import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionAnalyzer } from '../core/parsing/SessionAnalyzer.js';

const analyzer = new SessionAnalyzer();

describe('deterministic parsing', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'chat-analyze-determinism-'),
    );
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

  it('parses a Gemini JSON session into an identical result twice', async () => {
    const filePath = await write('session.json', {
      sessionId: 'stable-1',
      projectName: 'demo',
      messages: [
        { id: 'u1', type: 'user', content: 'hi' },
        { id: 'g1', type: 'gemini', content: 'hello', model: 'gemini-pro' },
      ],
    });

    expect(await analyzer.analyze(filePath)).toEqual(
      await analyzer.analyze(filePath),
    );
  });

  it('parses a checkpoint into an identical result twice', async () => {
    const filePath = await write('checkpoint-demo.json', {
      history: [
        { role: 'user', parts: [{ text: 'hi' }] },
        { role: 'model', parts: [{ text: 'hello' }] },
      ],
    });

    const first = await analyzer.analyze(filePath);
    const second = await analyzer.analyze(filePath);

    expect(first).toEqual(second);
    expect(first.sessions[0].startTime).toBe(
      new Date((await fs.stat(filePath)).mtimeMs).toISOString(),
    );
  });

  it('parses a JSONL session into an identical result twice', async () => {
    const filePath = await write(
      'session.jsonl',
      [
        JSON.stringify({ sessionId: 'jsonl-1' }),
        JSON.stringify({
          id: 'u1',
          type: 'user',
          timestamp: '2026-01-01T00:00:00.000Z',
          content: [{ text: 'hi' }],
        }),
        JSON.stringify({
          type: 'gemini',
          content: 'hello',
          timestamp: '2026-01-01T00:00:01.000Z',
        }),
      ].join('\n'),
    );

    const first = await analyzer.analyze(filePath);
    const second = await analyzer.analyze(filePath);

    expect(first).toEqual(second);
    // The second message has no id in the log and must get a stable one.
    const ids = first.sessions[0].messages.map((message) => message.id);
    expect(ids[1]).toBe(second.sessions[0].messages.map((m) => m.id)[1]);
    expect(ids[1].length).toBeGreaterThan(0);
  });

  it('parses a ChatGPT export into an identical result twice', async () => {
    const filePath = await write('chatgpt.json', {
      conversation_id: 'conv-1',
      current_node: 'n2',
      mapping: {
        n1: {
          parent: null,
          message: {
            id: 'n1',
            author: { role: 'user' },
            content: { parts: ['hi'] },
            create_time: 1711353600,
          },
        },
        n2: {
          parent: 'n1',
          message: {
            id: 'n2',
            author: { role: 'assistant' },
            content: { parts: ['hello'] },
            create_time: 1711353601,
          },
        },
      },
    });

    expect(await analyzer.analyze(filePath)).toEqual(
      await analyzer.analyze(filePath),
    );
  });
});

describe('parse warnings', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'chat-analyze-warnings-'),
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('reports invalid JSON as a warning instead of throwing', async () => {
    const filePath = path.join(tempDir, 'broken.json');
    await fs.writeFile(filePath, '{not json');

    const result = await analyzer.analyze(filePath);

    expect(result.sessions).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].filePath).toBe(filePath);
  });

  it('reports malformed JSONL lines but keeps the valid ones', async () => {
    const filePath = path.join(tempDir, 'partial.jsonl');
    await fs.writeFile(
      filePath,
      [
        JSON.stringify({ sessionId: 'partial' }),
        'not json',
        JSON.stringify({
          id: 'u1',
          type: 'user',
          timestamp: '2026-01-01T00:00:00.000Z',
          content: [{ text: 'kept' }],
        }),
      ].join('\n'),
    );

    const result = await analyzer.analyze(filePath);

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].messages).toHaveLength(1);
    expect(result.warnings[0].reason).toContain('line 2');
  });

  it('reports unsupported array entries and still parses the rest', async () => {
    const filePath = path.join(tempDir, 'export.json');
    await fs.writeFile(
      filePath,
      JSON.stringify([
        {
          id: 'conv-1',
          current_node: 'n1',
          mapping: {
            n1: {
              parent: null,
              message: {
                id: 'n1',
                author: { role: 'user' },
                content: { parts: ['hello'] },
                create_time: 1711353600,
              },
            },
          },
        },
        { something: 'unrelated' },
      ]),
    );

    const result = await analyzer.analyze(filePath);

    expect(result.sessions).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toContain('entry 1');
  });
});
