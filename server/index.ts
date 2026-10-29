import { loadConfig } from './config/index.js';
import { logResolvedConfig } from './config/log.js';
import { startServer } from './api/server.js';
import { SessionManager } from './core/manager.js';
import { SessionAnalyzer } from './core/parsing/SessionAnalyzer.js';
import { SessionStorage } from './db/storage.js';
import { DiscoveryService } from './core/services/DiscoveryService.js';
import { ProjectResolver } from './core/services/ProjectResolver.js';
import { ChatWatcher } from './core/watcher.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  logResolvedConfig(config);

  // Persistence is dormant by default: the SQLite design is kept, but no
  // write happens until PERSISTENCE=sqlite.
  const storage =
    config.persistence === 'sqlite' ? new SessionStorage(config.dbPath) : null;

  // Filesystem is the source of truth: index first, then watch for changes.
  const manager = new SessionManager(
    config.watchPaths,
    new SessionAnalyzer(),
    storage,
    new DiscoveryService(),
    new ProjectResolver(),
  );

  try {
    await manager.init();
  } catch (err) {
    console.error('[Manager] Initial synchronization failed:', err);
  }

  const watcher = new ChatWatcher(config.watchPaths, manager);
  watcher.start();

  await startServer(
    { manager, exportsDir: config.exportsDir },
    { port: config.port, host: config.host },
  );

  console.log('[System] Service is ready.');
  console.log(`[System] API: http://${config.host}:${config.port}`);

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

bootstrap().catch((err) => {
  console.error('[Fatal] Failed to start:', err);
  process.exit(1);
});
