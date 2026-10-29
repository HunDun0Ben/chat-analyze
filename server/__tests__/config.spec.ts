import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRepoRoot, loadConfig } from '../config/index.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const tempDirs: string[] = [];

async function makeRepo(
  files: Record<string, string | Record<string, unknown>> = {},
): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-analyze-config-'));
  tempDirs.push(root);

  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(root, name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      typeof content === 'string' ? content : JSON.stringify(content),
    );
  }

  return root;
}

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe('findRepoRoot', () => {
  it('finds the workspace root of this repository', () => {
    expect(findRepoRoot()).toBe(path.resolve(testDir, '../..'));
  });
});

describe('loadConfig watch paths precedence', () => {
  it('prefers environment over config.json and .env', async () => {
    const root = await makeRepo({
      'config.json': { watchPaths: ['/from-config'] },
      '.env': 'WATCH_PATHS=/from-dotenv\n',
    });

    const config = loadConfig({
      repoRoot: root,
      cwd: root,
      env: { WATCH_PATHS: '/from-env' },
    });

    expect(config.watchPaths).toEqual(['/from-env']);
    expect(config.watchPathsSource).toBe('env');
  });

  it('prefers config.json over .env', async () => {
    const root = await makeRepo({
      'config.json': { watchPaths: ['/from-config'] },
      '.env': 'WATCH_PATHS=/from-dotenv\n',
    });

    const config = loadConfig({ repoRoot: root, cwd: root, env: {} });

    expect(config.watchPaths).toEqual(['/from-config']);
    expect(config.watchPathsSource).toBe('config.json');
    expect(config.watchPathsSourcePath).toBe(path.join(root, 'config.json'));
  });

  it('falls back to .env when no environment or config.json exists', async () => {
    const root = await makeRepo({
      '.env': 'WATCH_PATHS=/from-dotenv\n',
    });

    const config = loadConfig({ repoRoot: root, cwd: root, env: {} });

    expect(config.watchPaths).toEqual(['/from-dotenv']);
    expect(config.watchPathsSource).toBe('.env');
    expect(config.watchPathsSourcePath).toBe(path.join(root, '.env'));
  });

  it('uses the default watch path when nothing is configured', async () => {
    const root = await makeRepo();

    const config = loadConfig({ repoRoot: root, cwd: root, env: {} });

    expect(config.watchPathsSource).toBe('default');
    expect(config.watchPaths).toEqual([path.join(os.homedir(), '.gemini/tmp')]);
  });

  it('expands "~" and resolves relative entries against cwd', async () => {
    const root = await makeRepo();

    const config = loadConfig({
      repoRoot: root,
      cwd: root,
      env: { WATCH_PATHS: '~/sessions:./local-sessions' },
    });

    expect(config.watchPaths).toEqual([
      path.join(os.homedir(), 'sessions'),
      path.join(root, 'local-sessions'),
    ]);
  });
});

describe('loadConfig scalar settings', () => {
  it('reads PORT / HOST from the real environment', async () => {
    const root = await makeRepo({ '.env': 'PORT=4100\nHOST=0.0.0.0\n' });

    const config = loadConfig({
      repoRoot: root,
      cwd: root,
      env: { PORT: '5000', HOST: '192.168.1.10' },
    });

    expect(config.port).toBe(5000);
    expect(config.host).toBe('192.168.1.10');
  });

  it('reads PORT / HOST from .env when the environment is empty', async () => {
    const root = await makeRepo({ '.env': 'PORT=4100\nHOST=0.0.0.0\n' });

    const config = loadConfig({ repoRoot: root, cwd: root, env: {} });

    expect(config.port).toBe(4100);
    expect(config.host).toBe('0.0.0.0');
  });

  it('defaults port and host to loopback', async () => {
    const root = await makeRepo();

    const config = loadConfig({ repoRoot: root, cwd: root, env: {} });

    expect(config.port).toBe(3001);
    expect(config.host).toBe('127.0.0.1');
  });

  it('derives dbPath and exportsDir from the repository root, not cwd', async () => {
    const root = await makeRepo();
    const otherCwd = await makeRepo();

    const config = loadConfig({
      repoRoot: root,
      cwd: otherCwd,
      env: {},
    });

    expect(config.dbPath).toBe(path.join(root, 'server/chat_analyze.db'));
    expect(config.exportsDir).toBe(path.join(root, 'exports/skills'));
  });

  it('honours DB_PATH / EXPORTS_DIR overrides', async () => {
    const root = await makeRepo();

    const config = loadConfig({
      repoRoot: root,
      cwd: root,
      env: { DB_PATH: '~/db/chat.db', EXPORTS_DIR: '/tmp/exports' },
    });

    expect(config.dbPath).toBe(path.join(os.homedir(), 'db/chat.db'));
    expect(config.exportsDir).toBe('/tmp/exports');
  });

  it('rejects an invalid PORT instead of silently using the default', async () => {
    const root = await makeRepo();

    expect(() =>
      loadConfig({ repoRoot: root, cwd: root, env: { PORT: 'not-a-port' } }),
    ).toThrow(/Invalid PORT/);
  });
});

describe('loadConfig persistence', () => {
  it('disables persistence by default', async () => {
    const root = await makeRepo();

    const config = loadConfig({ repoRoot: root, cwd: root, env: {} });

    expect(config.persistence).toBe('off');
  });

  it('enables sqlite through the environment', async () => {
    const root = await makeRepo();

    const config = loadConfig({
      repoRoot: root,
      cwd: root,
      env: { PERSISTENCE: 'sqlite' },
    });

    expect(config.persistence).toBe('sqlite');
  });

  it('enables sqlite through .env', async () => {
    const root = await makeRepo({ '.env': 'PERSISTENCE=sqlite\n' });

    const config = loadConfig({ repoRoot: root, cwd: root, env: {} });

    expect(config.persistence).toBe('sqlite');
  });

  it('treats an explicit "off" as disabled', async () => {
    const root = await makeRepo();

    const config = loadConfig({
      repoRoot: root,
      cwd: root,
      env: { PERSISTENCE: 'off' },
    });

    expect(config.persistence).toBe('off');
  });

  it('rejects an unknown persistence mode', async () => {
    const root = await makeRepo();

    expect(() =>
      loadConfig({ repoRoot: root, cwd: root, env: { PERSISTENCE: 'redis' } }),
    ).toThrow(/Invalid PERSISTENCE/);
  });
});
