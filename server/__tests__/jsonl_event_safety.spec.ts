import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionParser } from '../core/parser.js';

async function writeJsonl(
  dir: string,
  name: string,
  records: unknown[],
): Promise<string> {
  const filePath = path.join(dir, name);
  await fs.writeFile(
    filePath,
    records.map((r) => JSON.stringify(r)).join('\n'),
  );
  return filePath;
}

describe('GeminiJsonlParser event safety', () => {
  let tempDir: string;
  const parser = new SessionParser();

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-analyze-jsonl-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('joins multiple content parts with a real newline', async () => {
    const filePath = await writeJsonl(tempDir, 'session-multi.jsonl', [
      { sessionId: 'multi', startTime: '2026-01-01T00:00:00.000Z' },
      {
        id: 'u1',
        type: 'user',
        timestamp: '2026-01-01T00:00:01.000Z',
        content: [
          { text: 'first line' },
          { text: 'second line' },
          'third line',
        ],
      },
    ]);

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');

    expect(result.messages[0].content).toBe(
      'first line\nsecond line\nthird line',
    );
    expect(result.messages[0].content).not.toContain('\\n');
  });

  it('ignores $set keys outside the metadata whitelist', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const filePath = await writeJsonl(tempDir, 'session-set.jsonl', [
      { sessionId: 'set-test', startTime: '2026-01-01T00:00:00.000Z' },
      {
        id: 'u1',
        type: 'user',
        timestamp: '2026-01-01T00:00:01.000Z',
        content: [{ text: 'keep me' }],
      },
      { $set: { messages: [], sessionId: 'hijacked' } },
      { $set: { lastUpdated: '2026-01-01T00:00:02.000Z' } },
    ]);

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');

    expect(result.sessionId).toBe('set-test');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe('keep me');
    expect(result.lastUpdated).toBe('2026-01-01T00:00:02.000Z');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('unsupported $set key'),
    );
  });

  it('still applies whitelisted $set fields', async () => {
    const filePath = await writeJsonl(tempDir, 'session-title.jsonl', [
      { sessionId: 'title-test' },
      {
        id: 'u1',
        type: 'user',
        timestamp: '2026-01-01T00:00:01.000Z',
        content: [{ text: 'question' }],
      },
      { $set: { sessionTitle: 'Renamed session' } },
    ]);

    const result = await parser.analyze(filePath);
    if (Array.isArray(result)) throw new Error('Expected single session');

    expect(result.sessionTitle).toBe('Renamed session');
  });
});
