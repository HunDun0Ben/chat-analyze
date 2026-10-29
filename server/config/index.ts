import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

export type ConfigSource = 'env' | 'config.json' | '.env' | 'default';

export interface ServerConfig {
  /** Repository root, discovered by walking up to the workspace package.json. */
  repoRoot: string;
  watchPaths: string[];
  watchPathsSource: ConfigSource;
  watchPathsSourcePath?: string;
  port: number;
  host: string;
  dbPath: string;
  exportsDir: string;
}

export interface LoadConfigOptions {
  /** Environment to read. Defaults to `process.env`; injectable for tests. */
  env?: NodeJS.ProcessEnv;
  /** Base directory for relative watch paths. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Overrides repository-root discovery. Intended for tests. */
  repoRoot?: string;
  /** Set to false to ignore `.env` files (tests, CI). Defaults to true. */
  loadDotEnv?: boolean;
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3001;
const DEFAULT_HOST = '127.0.0.1';

function splitPaths(value: string): string[] {
  return value
    .split(':')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function expandHome(value: string, homeDir: string): string {
  if (value === '~') return homeDir;
  if (value.startsWith('~/')) return path.join(homeDir, value.slice(2));
  return value;
}

/**
 * Walks upwards until it finds the monorepo root (the package.json that
 * declares `workspaces`). Using the module location instead of `process.cwd()`
 * keeps `dbPath` / `exportsDir` identical whether the server is started via
 * `tsx server/index.ts`, `node server/dist/index.js`, or from another cwd.
 */
export function findRepoRoot(startDir: string = MODULE_DIR): string {
  let dir = path.resolve(startDir);

  for (;;) {
    const packagePath = path.join(dir, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as {
          workspaces?: unknown;
        };
        if (Array.isArray(parsed.workspaces)) return dir;
      } catch {
        // Ignore malformed package.json and keep walking up.
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(startDir);
    dir = parent;
  }
}

function readConfigJson(configPath: string): string[] | null {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<
      string,
      unknown
    >;

    if (Array.isArray(config.watchPaths)) {
      const paths = config.watchPaths.filter(
        (value): value is string => typeof value === 'string',
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

function readDotEnv(envPath: string): NodeJS.ProcessEnv | null {
  try {
    // `parseEnv` parses without mutating `process.env`, so the caller keeps
    // full control over precedence (real env > .env).
    return parseEnv(fs.readFileSync(envPath, 'utf-8'));
  } catch (err) {
    console.warn(`[Config] Failed to read ${envPath}:`, (err as Error).message);
    return null;
  }
}

function findFirstExisting(
  dirs: string[],
  fileName: string,
): string | undefined {
  for (const dir of new Set(dirs)) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`[Config] Invalid PORT: "${value}"`);
  }
  return port;
}

/**
 * Resolves the effective server configuration.
 *
 * Precedence for watch paths: environment > config.json > .env > default.
 * Precedence for scalar settings: environment > .env > default.
 */
export function loadConfig(options: LoadConfigOptions = {}): ServerConfig {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const homeDir = os.homedir();

  const dotEnvPath =
    options.loadDotEnv === false
      ? undefined
      : findFirstExisting([repoRoot, cwd], '.env');
  const dotEnv = dotEnvPath ? readDotEnv(dotEnvPath) : null;

  // Real environment always wins over values coming from the .env file.
  const mergedEnv: NodeJS.ProcessEnv = { ...dotEnv, ...env };

  let watchPaths: string[] | undefined;
  let watchPathsSource: ConfigSource = 'default';
  let watchPathsSourcePath: string | undefined;

  const envWatchPaths =
    env.WATCH_PATHS ?? env.WATCH_PATH ?? env.WATCH ?? undefined;
  if (envWatchPaths) {
    const paths = splitPaths(envWatchPaths);
    if (paths.length > 0) {
      watchPaths = paths;
      watchPathsSource = 'env';
    }
  }

  if (!watchPaths) {
    const configPath = findFirstExisting(
      [repoRoot, path.join(repoRoot, 'server'), cwd],
      'config.json',
    );
    if (configPath) {
      const paths = readConfigJson(configPath);
      if (paths) {
        watchPaths = paths;
        watchPathsSource = 'config.json';
        watchPathsSourcePath = configPath;
      }
    }
  }

  if (!watchPaths && dotEnv) {
    const dotEnvWatchPaths =
      dotEnv.WATCH_PATHS ?? dotEnv.WATCH_PATH ?? dotEnv.WATCH ?? undefined;
    if (dotEnvWatchPaths) {
      const paths = splitPaths(dotEnvWatchPaths);
      if (paths.length > 0) {
        watchPaths = paths;
        watchPathsSource = '.env';
        watchPathsSourcePath = dotEnvPath;
      }
    }
  }

  if (watchPathsSource === 'env' && !env.WATCH_PATHS && !env.WATCH_PATH) {
    // `WATCH` is the legacy alias documented in older READMEs.
    console.warn(
      '[Config] WATCH is deprecated and will be removed; use WATCH_PATHS instead.',
    );
  }

  const defaultWatchPath = path.join(homeDir, '.gemini/tmp');
  const resolvedWatchPaths = (watchPaths ?? [defaultWatchPath]).map((entry) =>
    path.resolve(cwd, expandHome(entry, homeDir)),
  );

  return {
    repoRoot,
    watchPaths: resolvedWatchPaths,
    watchPathsSource,
    watchPathsSourcePath,
    port: parsePort(mergedEnv.PORT, DEFAULT_PORT),
    host: mergedEnv.HOST?.trim() || DEFAULT_HOST,
    dbPath: path.resolve(
      cwd,
      expandHome(
        mergedEnv.DB_PATH?.trim() ||
          path.join(repoRoot, 'server/chat_analyze.db'),
        homeDir,
      ),
    ),
    exportsDir: path.resolve(
      cwd,
      expandHome(
        mergedEnv.EXPORTS_DIR?.trim() || path.join(repoRoot, 'exports/skills'),
        homeDir,
      ),
    ),
  };
}
