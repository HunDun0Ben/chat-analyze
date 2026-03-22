/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Entry Point
 */

import { ChatWatcher } from './watcher.js';
import { startServer } from './server.js';
import { SessionManager } from './manager.js';
import path from 'node:path';
import os from 'node:os';

async function bootstrap() {
  const homeDir = os.homedir();
  // 默认扫描路径：Gemini CLI 的临时对话存储目录
  // 注意：process.env.WATCH_PATH 可能会带 ~，如果是从 shell 传进来的，bash 会展开，但 js 不会。
  let watchPath = process.env.WATCH_PATH || path.join(homeDir, '.gemini/tmp');
  
  if (watchPath.startsWith('~')) {
    watchPath = path.join(homeDir, watchPath.slice(1));
  }

  console.log('--- Gemini Chat Analyze & Evolver ---');
  console.log(`[System] Initializing with path: ${watchPath}`);
  
  // 1. 初始化内存管理器
  const manager = new SessionManager(watchPath);
  await manager.init();

  // 2. 启动文件监听器
  const watcher = new ChatWatcher(watchPath, manager);
  watcher.start();

  // 3. 启动 API 服务器
  startServer(manager);

  console.log('[System] Service is ready.');
  console.log(`[System] API: http://localhost:3001`);
  console.log('Press Ctrl+C to stop.');

  process.on('SIGINT', async () => {
    console.log('\n[System] Shutting down...');
    try {
      await watcher.stop();
    } catch (err) {
      console.error('Error during shutdown:', err);
    }
    process.exit(0);
  });
}

bootstrap().catch(err => {
  console.error('[Fatal] Failed to start:', err);
  process.exit(1);
});
