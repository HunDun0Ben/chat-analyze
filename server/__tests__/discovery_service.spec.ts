import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DiscoveryService } from '../core/services/DiscoveryService.js';

describe('DiscoveryService', () => {
  let root: string;
  let service: DiscoveryService;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-analyze-discovery-'));

    const files: Record<string, string> = {
      'root.json': '{}',
      'package.json': '{}',
      'project-a/chats/session.json': '{}',
      'project-b/session.jsonl': '{}\n',
      'nested/技术组件/Vite/session.json': '{}',
      '.obsidian/app.json': '{}',
      '.trash/broken.json': '{}',
      'exports/hidden.json': '{}',
    };

    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = path.join(root, relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    }

    service = new DiscoveryService();
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('collects root and nested session files while skipping ignored entries', async () => {
    const results = await service.scan([root]);
    const relativePaths = results
      .map((result) => path.relative(root, result.filePath))
      .sort();

    expect(relativePaths).toEqual([
      'nested/技术组件/Vite/session.json',
      'project-a/chats/session.json',
      'project-b/session.jsonl',
      'root.json',
    ]);
  });

  it('assigns generic project names and records the watch root', async () => {
    const results = await service.scan([root]);
    const byPath = new Map(
      results.map((result) => [
        path.relative(root, result.filePath),
        result.projectName,
      ]),
    );

    expect(byPath.get('root.json')).toBe('Imported');
    expect(byPath.get('project-a/chats/session.json')).toBe('project-a');
    expect(byPath.get('project-b/session.jsonl')).toBe('project-b');
    expect(byPath.get('nested/技术组件/Vite/session.json')).toBe('nested');
    expect(results.every((result) => result.watchRoot === root)).toBe(true);
  });

  it('does not return duplicate files for overlapping watch paths', async () => {
    const results = await service.scan([root, path.join(root, 'project-b')]);
    const filePaths = results.map((result) => result.filePath);

    expect(new Set(filePaths).size).toBe(filePaths.length);
    expect(filePaths).toHaveLength(4);
  });
});
