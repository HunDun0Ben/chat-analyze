import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShutdownHandler,
  shutdownComponents,
  type ShutdownLogger,
  type ShutdownTargets,
} from '../lifecycle.js';

const silentLogger: ShutdownLogger = {
  log: () => {},
  error: () => {},
};

function makeTargets(calls: string[]): ShutdownTargets {
  return {
    watcher: {
      stop: async () => {
        calls.push('watcher');
      },
    },
    server: {
      close: (callback?: (error?: Error) => void) => {
        calls.push('server');
        callback?.();
      },
    },
    storage: {
      close: () => {
        calls.push('storage');
      },
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('shutdownComponents', () => {
  it('closes watcher, server and storage in dependency order', async () => {
    const calls: string[] = [];

    await shutdownComponents(makeTargets(calls), silentLogger);

    expect(calls).toEqual(['watcher', 'server', 'storage']);
  });

  it('still closes the remaining components when one step fails', async () => {
    const calls: string[] = [];
    const targets = makeTargets(calls);
    targets.watcher.stop = () => {
      calls.push('watcher');
      throw new Error('watcher already closed');
    };

    await expect(shutdownComponents(targets, silentLogger)).rejects.toThrow(
      /watcher/,
    );
    expect(calls).toEqual(['watcher', 'server', 'storage']);
  });

  it('skips storage when persistence is disabled', async () => {
    const calls: string[] = [];

    await shutdownComponents(
      { ...makeTargets(calls), storage: null },
      silentLogger,
    );

    expect(calls).toEqual(['watcher', 'server']);
  });

  it('waits for the HTTP server to finish closing', async () => {
    const calls: string[] = [];
    let finishClose: (() => void) | undefined;
    const targets: ShutdownTargets = {
      watcher: {
        stop: () => {
          calls.push('watcher');
        },
      },
      server: {
        close: (callback?: (error?: Error) => void) => {
          calls.push('server');
          finishClose = () => callback?.();
        },
      },
    };

    const shutdown = shutdownComponents(targets, silentLogger);
    await vi.waitFor(() => expect(calls).toEqual(['watcher', 'server']));

    finishClose?.();
    await shutdown;
  });
});

describe('createShutdownHandler', () => {
  it('is idempotent and exits 0 after a clean shutdown', async () => {
    const calls: string[] = [];
    const exit = vi.fn();
    const handler = createShutdownHandler({
      targets: makeTargets(calls),
      logger: silentLogger,
      exit,
    });

    await Promise.all([handler('SIGINT'), handler('SIGTERM')]);

    expect(calls).toEqual(['watcher', 'server', 'storage']);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('forces exit code 1 after the timeout', async () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    const handler = createShutdownHandler({
      targets: {
        watcher: { stop: () => new Promise<void>(() => {}) },
        server: { close: () => {} },
      },
      timeoutMs: 10_000,
      logger: silentLogger,
      exit,
    });

    void handler('SIGTERM');
    await vi.advanceTimersByTimeAsync(10_000);

    expect(exit).toHaveBeenCalledWith(1);
  });
});
