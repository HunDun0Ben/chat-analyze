import fs from 'node:fs/promises';
import path from 'node:path';
import {
  isIgnoredDirName,
  isIgnoredFileName,
  isSessionFileName,
} from './discovery/ignored.js';
import { genericProjectName } from './discovery/projectNaming.js';

export interface DiscoveryResult {
  filePath: string;
  projectName: string;
  watchRoot: string;
}

export class DiscoveryService {
  /**
   * Scan multiple watch paths for session files.
   *
   * Discovery is provider-agnostic: it only knows which files are potential
   * sessions. Provider-specific project naming happens later in
   * ProjectResolver, once the parser has determined the provider.
   */
  async scan(watchPaths: string[]): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];
    const seen = new Set<string>();

    for (const watchPath of watchPaths) {
      try {
        const files = await this.collectFiles(watchPath);

        for (const filePath of files) {
          if (seen.has(filePath)) continue;
          seen.add(filePath);

          results.push({
            filePath,
            watchRoot: watchPath,
            projectName: genericProjectName(filePath, watchPath),
          });
        }
      } catch (err) {
        console.error(`[DiscoveryService] Failed to scan ${watchPath}:`, err);
      }
    }

    return results.sort((a, b) => a.filePath.localeCompare(b.filePath));
  }

  /**
   * Collect session files from the watch root: root-level files plus every
   * non-ignored subdirectory (recursively).
   */
  private async collectFiles(watchPath: string): Promise<string[]> {
    const entries = await fs.readdir(watchPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(watchPath, entry.name);

      if (entry.isDirectory()) {
        if (isIgnoredDirName(entry.name)) continue;
        await this.collectSessions(fullPath, files);
      } else if (entry.isFile() && this.isSessionFile(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Recursively collect session files from a directory.
   */
  private async collectSessions(dir: string, files: string[]) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (isIgnoredDirName(entry.name)) continue;
          await this.collectSessions(fullPath, files);
        } else if (entry.isFile() && this.isSessionFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      console.error(`Error collecting sessions from ${dir}:`, e);
    }
  }

  private isSessionFile(name: string): boolean {
    return isSessionFileName(name) && !isIgnoredFileName(name);
  }
}
