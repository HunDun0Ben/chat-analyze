import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectResolver } from '../core/services/ProjectResolver.js';
import { findWatchRoot } from '../core/services/discovery/projectNaming.js';

describe('findWatchRoot', () => {
  it('prefers the longest overlapping watch path', () => {
    expect(
      findWatchRoot('/home/user/end2/project/session.json', [
        '/home/user/end',
        '/home/user/end2',
      ]),
    ).toBe('/home/user/end2');
  });

  it('does not match a sibling directory sharing a name prefix', () => {
    expect(
      findWatchRoot('/home/user/end2/session.json', ['/home/user/end']),
    ).toBeUndefined();
  });
});

describe('ProjectResolver', () => {
  const resolver = new ProjectResolver();
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'chat-analyze-resolver-'),
    );
    await fs.mkdir(path.join(tempDir, 'marked-project'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'marked-project', '.project_root'),
      '',
    );
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('groups ChatGPT root-level conversations under "ChatGPT Import"', async () => {
    const filePath = path.join(tempDir, 'conversation.json');
    await expect(
      resolver.resolve('chatgpt', filePath, [tempDir]),
    ).resolves.toBe('ChatGPT Import');
  });

  it('uses the top-level folder for nested ChatGPT conversations', async () => {
    const filePath = path.join(
      tempDir,
      '技术组件',
      'Vite',
      'conversation.json',
    );
    await expect(
      resolver.resolve('chatgpt', filePath, [tempDir]),
    ).resolves.toBe('技术组件');
  });

  it('resolves Gemini projects under a "chats" directory', async () => {
    const filePath = path.join(tempDir, 'my-project', 'chats', 'session.json');
    await expect(resolver.resolve('gemini', filePath, [tempDir])).resolves.toBe(
      'my-project',
    );
  });

  it('resolves Gemini projects when "chats" is the container directory', async () => {
    const filePath = path.join(tempDir, 'chats', 'my-project', 'session.json');
    await expect(resolver.resolve('gemini', filePath, [tempDir])).resolves.toBe(
      'my-project',
    );
  });

  it('honors Gemini project markers', async () => {
    const filePath = path.join(
      tempDir,
      'marked-project',
      'sessions',
      'session.json',
    );
    await expect(resolver.resolve('gemini', filePath, [tempDir])).resolves.toBe(
      'marked-project',
    );
  });

  it('returns Unknown when the file is outside every watch path', async () => {
    await expect(
      resolver.resolve('gemini', '/etc/session.json', [tempDir]),
    ).resolves.toBe('Unknown');
  });

  it('detects placeholder project names per provider', () => {
    expect(resolver.isPlaceholder('chatgpt', 'ChatGPT Import')).toBe(true);
    expect(resolver.isPlaceholder('chatgpt', 'Imported')).toBe(true);
    expect(resolver.isPlaceholder('chatgpt', '技术组件')).toBe(false);

    expect(resolver.isPlaceholder('gemini', 'Unknown')).toBe(true);
    expect(resolver.isPlaceholder('gemini', 'a'.repeat(64))).toBe(true);
    expect(resolver.isPlaceholder('gemini', 'redis')).toBe(false);
  });
});
