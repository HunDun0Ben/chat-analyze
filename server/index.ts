import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer } from './api/server.js';
import { SessionManager } from './core/manager.js';
import { SessionParser } from './core/parser.js';
import { SessionStorage } from './db/storage.js';
import { DiscoveryService } from './core/services/DiscoveryService.js';
import { ProjectResolver } from './core/services/ProjectResolver.js';
import { ChatWatcher } from './core/watcher.js';

type ConfigSource = 'env' | 'config.json' | '.env' | 'default';

interface WatchPathConfig {
  paths: string[];
  source: ConfigSource;
  sourcePath?: string;
}

function splitPaths(value: string): string[] {
  return value
    .split(':')
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Candidate directories for `config.json` / `.env`, independent of the
 * process cwd. Running via `npm run dev -w @chat-analyze/server` sets the cwd
 * to `server/`, so relying on `process.cwd()` alone misses the repo root.
 */
function getConfigSearchDirs(): string[] {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return Array.from(
    new Set([path.resolve(moduleDir, '..'), moduleDir, process.cwd()]),
  );
}

function parseConfigFile(configPath: string): string[] | null {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (Array.isArray(config.watchPaths)) {
      const paths = config.watchPaths.filter(
        (value: unknown): value is string => typeof value === 'string',
      );
      if (paths.length > 0) return paths;
    }
    if (typeof config.WATCH_PATHS === 'string') {
      const paths = splitPaths(config.WATCH_PATHS);
      if (paths.length > 0) return paths;
    }
  } catch (err) {
    console.warn(
      `[Config] Failed to parse ${configPath}:`,
      (err as Error).message,
    );
  }
  return null;
}

function parseDotEnvFile(envFilePath: string): string[] | null {
  try {
    const content = fs.readFileSync(envFilePath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(
        /^\s*(?:export\s+)?(WATCH_PATHS|WATCH_PATH)\s*=\s*(.*)$/,
      );
      if (!match) continue;

      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      const paths = splitPaths(value);
      if (paths.length > 0) return paths;
    }
  } catch (err) {
    console.warn(
      `[Config] Failed to read ${envFilePath}:`,
      (err as Error).message,
    );
  }
  return null;
}

/**
 * 加载监听路径配置
 * 优先级: 环境变量 > config.json > .env > 默认路径
 */
function getWatchPaths(homeDir: string): WatchPathConfig {
  // 1. 尝试从环境变量获取
  const envPaths = process.env.WATCH_PATHS || process.env.WATCH_PATH;
  if (envPaths) {
    const paths = splitPaths(envPaths);
    if (paths.length > 0) return { paths, source: 'env' };
  }

  // Backwards-compatible alias for the previously documented but unsupported
  // `WATCH` variable.
  if (process.env.WATCH) {
    const paths = splitPaths(process.env.WATCH);
    if (paths.length > 0) {
      console.warn(
        '[Config] WATCH is deprecated and will be removed; use WATCH_PATHS instead.',
      );
      return { paths, source: 'env' };
    }
  }

  const searchDirs = getConfigSearchDirs();

  // 2. 尝试从 config.json 获取 (仓库根 / server / cwd)
  for (const dir of searchDirs) {
    const configPath = path.join(dir, 'config.json');
    if (!fs.existsSync(configPath)) continue;

    const paths = parseConfigFile(configPath);
    if (paths) return { paths, source: 'config.json', sourcePath: configPath };
  }

  // 3. 尝试从 .env 获取 (仓库根 / server / cwd)
  for (const dir of searchDirs) {
    const envFilePath = path.join(dir, '.env');
    if (!fs.existsSync(envFilePath)) continue;

    const paths = parseDotEnvFile(envFilePath);
    if (paths) return { paths, source: '.env', sourcePath: envFilePath };
  }

  // 4. 返回默认路径
  return {
    paths: [path.join(homeDir, '.gemini/tmp')],
    source: 'default',
  };
}

async function bootstrap() {
  const homeDir = os.homedir();

  // 1. 解析监听路径
  const config = getWatchPaths(homeDir);

  const watchPaths = config.paths.map((p) => {
    let resolved = p.trim();
    if (resolved.startsWith('~')) {
      resolved = path.join(homeDir, resolved.slice(1));
    }
    return path.resolve(resolved);
  });

  console.log('--- Gemini Chat Analyze & Evolver ---');
  console.log(
    `[System] Config source: ${config.source}${config.sourcePath ? ` (${config.sourcePath})` : ''}`,
  );
  console.log(`[System] Initializing with ${watchPaths.length} paths:`);
  watchPaths.forEach((p) => console.log(`  - ${p}`));

  // 2. 实例化服务组件 (依赖注入)
  const parser = new SessionParser();
  const storage = new SessionStorage();
  const discoveryService = new DiscoveryService();
  const projectResolver = new ProjectResolver();

  // 3. 初始化 Session 管理器
  const manager = new SessionManager(
    watchPaths,
    parser,
    storage,
    discoveryService,
    projectResolver,
  );

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

bootstrap().catch((err) => {
  console.error('[Fatal] Failed to start:', err);
  process.exit(1);
});
