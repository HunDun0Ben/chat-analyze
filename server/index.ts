


import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { startServer } from './api/server.js';
import { SessionManager } from './core/manager.js';
import { SessionParser } from './core/parser.js';
import { SessionStorage } from './db/storage.js';
import { DiscoveryService } from './core/services/DiscoveryService.js';
import { ChatWatcher } from './core/watcher.js';

/**
 * 加载监听路径配置
 * 优先级: 环境变量 > config.json > .env > 默认路径
 */
function getWatchPaths(homeDir: string): string[] {
  // 1. 尝试从环境变量获取
  const envPaths = process.env.WATCH_PATHS || process.env.WATCH_PATH;
  if (envPaths) {
    return envPaths.split(':');
  }

  // 2. 尝试从 config.json 获取 (项目根目录)
  const rootDir = process.cwd();
  const configPath = path.join(rootDir, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (Array.isArray(config.watchPaths)) {
        return config.watchPaths;
      }
      if (typeof config.WATCH_PATHS === 'string') {
        return config.WATCH_PATHS.split(':');
      }
    } catch (err) {
      console.warn(`[Config] Failed to parse ${configPath}:`, (err as Error).message);
    }
  }

  // 3. 尝试从 .env 获取
  const envFilePath = path.join(rootDir, '.env');
  if (fs.existsSync(envFilePath)) {
    try {
      const content = fs.readFileSync(envFilePath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*WATCH_PATHS\s*=\s*(.*)$/);
        if (match) {
          let val = match[1].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          return val.split(':');
        }
      }
    } catch (err) {
      console.warn(`[Config] Failed to read ${envFilePath}:`, (err as Error).message);
    }
  }

  // 4. 返回默认路径
  return [path.join(homeDir, '.gemini/tmp')];
}

async function bootstrap() {
  const homeDir = os.homedir();
  
  // 1. 解析监听路径
  const rawPaths = getWatchPaths(homeDir);
  
  const watchPaths = rawPaths.map(p => {
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
