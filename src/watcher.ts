/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - File System Watcher Implementation
 */

import chokidar from 'chokidar';
import path from 'node:path';
import { SessionParser } from './parser.js';
import { SessionStorage } from './storage.js';

export class ChatWatcher {
  private watcher: chokidar.FSWatcher;
  private parser: SessionParser;
  private storage: SessionStorage;

  constructor(
    private watchPath: string,
    dbPath: string = './chat_analyze.db'
  ) {
    this.parser = new SessionParser();
    this.storage = new SessionStorage(dbPath);
    
    // 监听特定模式的 session 文件
    this.watcher = chokidar.watch(`${watchPath}/**/chats/session-*.json`, {
      persistent: true,
      ignoreInitial: false
    });
  }

  start() {
    console.log(`Watching for chat sessions in: ${this.watchPath}`);

    this.watcher.on('add', async (filePath) => {
      console.log(`[New Session Detected]: ${path.basename(filePath)}`);
      try {
        const session = await this.parser.analyze(filePath);
        this.storage.saveSession(session);
        console.log(`  - Successfully analyzed and stored.`);
      } catch (err) {
        console.error(`  - Failed to process ${filePath}:`, err);
      }
    });

    this.watcher.on('change', async (filePath) => {
      console.log(`[Session Updated]: ${path.basename(filePath)}`);
      try {
        const session = await this.parser.analyze(filePath);
        this.storage.saveSession(session);
        console.log(`  - Updated in database.`);
      } catch (err) {
        console.error(`  - Failed to update ${filePath}:`, err);
      }
    });
  }

  async stop() {
    await this.watcher.close();
    this.storage.close();
  }
}
