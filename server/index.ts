/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Entry Point
 */

import { ChatWatcher } from './core/watcher.js';
import { startServer } from './api/server.js';
import { SessionManager } from './core/manager.js';
import path from 'node:path';
import os from 'node:os';

async function bootstrap() {
  const homeDir = os.homedir();
  
  // 支持多个路径，用冒号分隔
  // 例如：WATCH_PATHS="~/.gemini/tmp:/path/to/chatgpt"
  const envPaths = process.env.WATCH_PATHS || process.env.WATCH_PATH || path.join(homeDir, '.gemini/tmp');
  
  const watchPaths = envPaths.split(':').map(p => {
    let resolved = p.trim();
    if (resolved.startsWith('~')) {
      resolved = path.join(homeDir, resolved.slice(1));
    }
    return path.resolve(resolved);
  });

  console.log('--- Gemini Chat Analyze & Evolver ---');
  console.log(`[System] Initializing with ${watchPaths.length} paths:`);
  watchPaths.forEach(p => console.log(`  - ${p}`));
  
  // 1. 初始化内存管理器
  const manager = new SessionManager(watchPaths);
  await manager.init();

  // 2. 启动文件监听器
  const watcher = new ChatWatcher(watchPaths, manager);
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
