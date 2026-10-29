import path from 'node:path';

/**
 * Directories that never contain session files.
 * Shared by DiscoveryService and ChatWatcher to keep both in sync.
 */
const IGNORED_DIRS = [
  'node_modules',
  '.git',
  'exports',
  'dist',
  'build',
  'logs',
  'community-plugins',
  '.obsidian',
  '.trash',
] as const;

/**
 * Reserved configuration files that match the session file extensions
 * but must never be parsed as sessions.
 */
const IGNORED_FILES = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'projects.json',
  'vitest.config.ts',
] as const;

const ignoredDirSet = new Set<string>(IGNORED_DIRS);
const ignoredFileSet = new Set<string>(IGNORED_FILES);

export function isIgnoredDirName(name: string): boolean {
  return ignoredDirSet.has(name);
}

export function isIgnoredFileName(name: string): boolean {
  if (ignoredFileSet.has(name)) return true;
  // `community-plugins.json` is a configuration file, not a session.
  return name === 'community-plugins.json';
}

export function isSessionFileName(name: string): boolean {
  return name.endsWith('.json') || name.endsWith('.jsonl');
}

/**
 * Returns true when any path segment is an ignored directory, or when the
 * basename is a reserved configuration file.
 */
export function shouldIgnorePath(filePath: string): boolean {
  const segments = filePath.split(path.sep);
  if (segments.some((segment) => isIgnoredDirName(segment))) return true;
  return isIgnoredFileName(path.basename(filePath));
}
