/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - File System Watcher Implementation
 */

import chokidar from 'chokidar';
import path from 'node:path';
import { SessionManager } from './manager.js';

export class ChatWatcher {
  private watcher: chokidar.FSWatcher;

  constructor(
    private watchPath: string,
    private manager: SessionManager
  ) {
    // 监听所有项目目录及其 chats 子目录下的 session 文件
    this.watcher = chokidar.watch([
      `${watchPath}/**/session-*.json`,
      `${watchPath}/**/chats/session-*.json`
    ], {
      persistent: true,
      ignoreInitial: true // 初始加载由 Manager 处理
    });
  }

  start() {
    console.log(`[Watcher] Monitoring for chat updates in: ${this.watchPath}`);

    this.watcher.on('add', async (filePath) => {
      if (!path.basename(filePath).startsWith('session-')) return;
      
      console.log(`[Detected]: ${path.basename(filePath)}`);
      try {
        const session = await this.manager.upsertFromFile(filePath);
        console.log(`  - Loaded [${session.projectName}] into memory`);
      } catch (err) {
        // Error already logged in manager
      }
    });

    this.watcher.on('change', async (filePath) => {
      console.log(`[Session Updated]: ${path.basename(filePath)}`);
      try {
        await this.manager.upsertFromFile(filePath);
        console.log(`  - Memory cache updated.`);
      } catch (err) {
        // Error already logged in manager
      }
    });
  }

  async stop() {
    await this.watcher.close();
  }
}
