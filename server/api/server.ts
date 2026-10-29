import type { Server } from 'node:http';
import { AppDeps, createApp } from '../app.js';

interface ListenOptions {
  port: number;
  host: string;
}

/**
 * Binds the app to a port. Returns the `http.Server` so the process can close
 * it during shutdown and so tests can await readiness.
 */
export async function startServer(
  deps: AppDeps,
  options: ListenOptions,
): Promise<Server> {
  const app = createApp(deps);

  return new Promise((resolve) => {
    const server = app.listen(options.port, options.host, () => {
      console.log(
        `[Server] API running at http://${options.host}:${options.port}`,
      );
      resolve(server);
    });
  });
}
