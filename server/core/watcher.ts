import * as chokidar from 'chokidar';
import path from 'node:path';
import { SessionManager } from './manager.js';

export class ChatWatcher {
  private watcher: chokidar.FSWatcher;

  constructor(
    private watchPaths: string[],
    private manager: SessionManager,
  ) {
    // 监听所有路径下的所有 JSON 文件
    // 使用通配符覆盖根目录和嵌套目录
    const patterns = watchPaths.flatMap((p) => [
      `${p}/*.json`,
      `${p}/**/*.json`,
    ]);

    this.watcher = chokidar.watch(patterns, {
      persistent: true,
      ignoreInitial: true,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/package.json',
        '**/package-lock.json',
        '**/tsconfig.json',
      ],
    });
  }

  start() {
    console.log(
      `[Watcher] Monitoring for chat updates in ${this.watchPaths.length} paths.`,
    );

    this.watcher.on('add', async (filePath: string) => {
      console.log(`[Detected]: ${path.basename(filePath)}`);
      try {
        const session = await this.manager.upsertFromFile(filePath);
        console.log(`  - Loaded [${session.projectName}] into memory`);
      } catch (err) {
        console.error(`Failed to load session from ${filePath}:`, err);
      }
    });

    this.watcher.on('change', async (filePath: string) => {
      console.log(`[Session Updated]: ${path.basename(filePath)}`);
      try {
        await this.manager.upsertFromFile(filePath);
        console.log(`  - Memory cache updated.`);
      } catch (err) {
        console.error(`Failed to update session from ${filePath}:`, err);
      }
    });
  }

  async stop() {
    await this.watcher.close();
  }
}
