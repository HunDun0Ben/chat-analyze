import fs from 'node:fs/promises';
import path from 'node:path';

function isInside(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

/**
 * Finds the watch path that contains the file. When watch paths overlap,
 * the most specific (longest) one wins.
 */
export function findWatchRoot(
  filePath: string,
  watchPaths: string[],
): string | undefined {
  let bestMatch: string | undefined;

  for (const watchPath of watchPaths) {
    if (!isInside(watchPath, filePath)) continue;
    if (!bestMatch || watchPath.length > bestMatch.length) {
      bestMatch = watchPath;
    }
  }

  return bestMatch;
}

/**
 * Generic, provider-agnostic project naming used as a fallback and as the
 * value returned by DiscoveryService. Root-level files are treated as
 * manual imports; nested files use their top-level directory name.
 */
export function genericProjectName(
  filePath: string,
  watchRoot: string,
): string {
  const relative = path.relative(watchRoot, filePath);
  const dir = path.dirname(relative);
  const parts = dir === '.' ? [] : dir.split(path.sep);

  if (parts.length > 0) {
    if (parts[0] === 'chats' && parts.length > 1) {
      return parts[1];
    }
    return parts[0];
  }

  return 'Imported';
}

async function hasMarker(dir: string): Promise<boolean> {
  try {
    const files = await fs.readdir(dir);
    return files.includes('.project_root') || files.includes('projects.json');
  } catch {
    return false;
  }
}

/**
 * Gemini layout: honor `.project_root` / `projects.json` markers by walking
 * upwards, then fall back to the relative-path heuristic.
 */
export async function geminiProjectName(
  filePath: string,
  watchRoot: string,
): Promise<string> {
  let currentDir = path.dirname(filePath);

  while (currentDir !== watchRoot && isInside(watchRoot, currentDir)) {
    if (await hasMarker(currentDir)) {
      return path.basename(currentDir);
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  return genericProjectName(filePath, watchRoot);
}

/**
 * ChatGPT exports have no project concept. Root-level files are individual
 * conversations and are grouped under `ChatGPT Import`; nested files keep
 * their top-level folder as the project name.
 */
export function chatgptProjectName(
  filePath: string,
  watchRoot: string,
): string {
  const name = genericProjectName(filePath, watchRoot);
  return name === 'Imported' ? 'ChatGPT Import' : name;
}
