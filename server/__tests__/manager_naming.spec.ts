import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SessionManager } from '../core/manager.js';
import { SessionAnalyzer } from '../core/parsing/SessionAnalyzer.js';
import { SessionStorage } from '../db/storage.js';
import { DiscoveryService } from '../core/services/DiscoveryService.js';
import { ProjectResolver } from '../core/services/ProjectResolver.js';

function chatgptConversation(id: string) {
  return {
    id,
    title: `Conversation ${id}`,
    current_node: 'node-2',
    mapping: {
      'node-1': {
        id: 'node-1',
        parent: null,
        message: {
          id: `${id}-m1`,
          author: { role: 'user' },
          content: { parts: ['Hello'] },
          create_time: 1711353600,
        },
      },
      'node-2': {
        id: 'node-2',
        parent: 'node-1',
        message: {
          id: `${id}-m2`,
          author: { role: 'assistant' },
          content: { parts: ['Hi there'] },
          create_time: 1711353601,
        },
      },
    },
  };
}

describe('SessionManager project naming', () => {
  let tempDir: string;
  let manager: SessionManager;
  const watchPaths: string[] = [];

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-analyze-manager-'));
    watchPaths.push(tempDir);

    await fs.mkdir(path.join(tempDir, '技术组件', 'Vite'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tempDir, 'root-conversation.json'),
      JSON.stringify(chatgptConversation('root-conv')),
    );
    await fs.writeFile(
      path.join(tempDir, '技术组件', 'Vite', 'nested-conversation.json'),
      JSON.stringify(chatgptConversation('nested-conv')),
    );

    await fs.mkdir(path.join(tempDir, 'gemini-marked-project', 'sessions'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tempDir, 'gemini-marked-project', '.project_root'),
      '',
    );
    await fs.writeFile(
      path.join(
        tempDir,
        'gemini-marked-project',
        'sessions',
        'gemini-session.json',
      ),
      JSON.stringify({
        sessionId: 'gemini-marked',
        projectName: 'Unknown',
        startTime: '2024-03-25T00:00:00.000Z',
        lastUpdated: '2024-03-25T00:00:00.000Z',
        messages: [
          {
            id: '1',
            type: 'user',
            content: 'Hello',
            timestamp: '2024-03-25T00:00:00.000Z',
          },
          {
            id: '2',
            type: 'gemini',
            content: 'Hi',
            timestamp: '2024-03-25T00:00:01.000Z',
            model: 'gemini-1.5-pro',
          },
        ],
      }),
    );

    manager = new SessionManager(
      watchPaths,
      new SessionAnalyzer(),
      new SessionStorage(':memory:'),
      new DiscoveryService(),
      new ProjectResolver(),
    );

    await manager.init();
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('uses provider-specific names during the boot scan', () => {
    expect(manager.getSession('root-conv')?.projectName).toBe('ChatGPT Import');
    expect(manager.getSession('nested-conv')?.projectName).toBe('技术组件');
    expect(manager.getSession('gemini-marked')?.projectName).toBe(
      'gemini-marked-project',
    );
  });

  it('produces the same project name when a file is reloaded by the watcher', async () => {
    const filePath = path.join(tempDir, 'root-conversation.json');
    await manager.upsertFromFile(filePath);

    expect(manager.getSession('root-conv')?.projectName).toBe('ChatGPT Import');
  });
});
