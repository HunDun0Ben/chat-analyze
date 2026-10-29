/** Hard limit for a graceful shutdown before the process is forced out. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

export interface ShutdownTargets {
  watcher: { stop(): Promise<void> | void };
  /** Structurally compatible with `node:http`'s `Server`. */
  server: { close(callback?: (error?: Error) => void): unknown };
  storage?: { close(): void } | null;
}

export interface ShutdownLogger {
  log(message: string): void;
  error(...args: unknown[]): void;
}

/**
 * Closes components in dependency order: stop producing work (watcher), stop
 * accepting requests (HTTP server), then release the database handle.
 *
 * Every step runs even if an earlier one throws; the collected failures are
 * rethrown afterwards so the process can exit non-zero.
 */
export async function shutdownComponents(
  targets: ShutdownTargets,
  logger: ShutdownLogger = console,
): Promise<void> {
  const failures: string[] = [];

  const run = async (name: string, step: () => Promise<void> | void) => {
    logger.log(`[Shutdown] ${name}...`);
    try {
      await step();
    } catch (error) {
      failures.push(name);
      logger.error(`[Shutdown] Failed to close ${name}:`, error);
    }
  };

  await run('watcher', () => targets.watcher.stop());

  await run(
    'http server',
    () =>
      new Promise<void>((resolve) => {
        targets.server.close(() => resolve());
      }),
  );

  if (targets.storage) {
    await run('storage', () => targets.storage?.close());
  }

  if (failures.length > 0) {
    throw new Error(
      `Shutdown did not complete cleanly: ${failures.join(', ')}`,
    );
  }

  logger.log('[Shutdown] All components closed.');
}

interface ShutdownHandlerOptions {
  targets: ShutdownTargets;
  timeoutMs?: number;
  logger?: ShutdownLogger;
  /** Injectable for tests; defaults to `process.exit`. */
  exit?: (code: number) => void;
}

/**
 * Returns an idempotent signal handler: the first `SIGINT` / `SIGTERM` runs
 * the ordered shutdown, later signals are ignored. If the shutdown does not
 * finish within `timeoutMs` the process exits with a failure code.
 */
export function createShutdownHandler({
  targets,
  timeoutMs = SHUTDOWN_TIMEOUT_MS,
  logger = console,
  exit = (code: number) => process.exit(code),
}: ShutdownHandlerOptions): (signal: NodeJS.Signals) => Promise<void> {
  let running: Promise<void> | null = null;

  return (signal: NodeJS.Signals) => {
    if (running) return running;

    logger.log(`\n[Shutdown] ${signal} received, shutting down...`);

    const timer = setTimeout(() => {
      logger.error(`[Shutdown] Timed out after ${timeoutMs}ms, forcing exit.`);
      exit(1);
    }, timeoutMs);
    timer.unref?.();

    running = shutdownComponents(targets, logger).then(
      () => {
        clearTimeout(timer);
        exit(0);
      },
      (error) => {
        clearTimeout(timer);
        logger.error('[Shutdown] Aborted:', error);
        exit(1);
      },
    );

    return running;
  };
}
