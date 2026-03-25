/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Entry Point
 */

import path from 'node:path';
import os from 'node:os';
import { startServer } from './api/server.js';
import { SessionManager } from './core/manager.js';
import { SessionParser } from './core/parser.js';
import { SessionStorage } from './db/storage.js';
import { DiscoveryService } from './core/services/DiscoveryService.js';
import { ChatWatcher } from './core/watcher.js';

async function bootstrap() {
  const homeDir = os.homedir();
  
  // 1. 解析监听路径
  const defaultPath = path.join(homeDir, '.gemini/tmp');
  const envPaths = process.env.WATCH_PATHS || process.env.WATCH_PATH || defaultPath;
  
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
  
  // 2. 实例化服务组件 (依赖注入)
  const parser = new SessionParser();
  const storage = new SessionStorage();
  const discoveryService = new DiscoveryService();

  // 3. 初始化 Session 管理器
  const manager = new SessionManager(watchPaths, parser, storage, discoveryService);
  
  // 启动时进行首次全量同步 (以目录为准)
  try {
    await manager.init();
  } catch (err) {
    console.error('[Manager] Initial synchronization failed:', err);
  }

  // 4. 启动文件监听器 (实时感知文件变动)
  const watcher = new ChatWatcher(watchPaths, manager);
  watcher.start();

  // 5. 启动 API 服务器
  startServer(manager);

  console.log('[System] Service is ready.');
  console.log(`[System] API: http://localhost:3001`);
  console.log('Press Ctrl+C to stop.');

  process.on('SIGINT', async () => {
    console.log('\n[System] Shutting down...');
    try {
      watcher.stop();
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
