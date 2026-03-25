/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Discovery Service
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export interface DiscoveryResult {
  filePath: string;
  projectName: string;
  isChatGPT: boolean;
}

export class DiscoveryService {
  private readonly ignoredDirs = ['node_modules', '.git', 'exports', 'dist', 'build'];

  /**
   * Scan multiple watch paths for session files
   */
  async scan(watchPaths: string[]): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];

    for (const watchPath of watchPaths) {
      try {
        const entries = await fs.readdir(watchPath, { withFileTypes: true });
        
        // 1. Root level files (potential ChatGPT exports or standalone sessions)
        const rootFiles = entries
          .filter(e => e.isFile() && e.name.endsWith('.json') && !this.isReservedConfig(e.name))
          .map(e => ({
            filePath: path.join(watchPath, e.name),
            projectName: 'Imported',
            isChatGPT: false // Will be refined by parser later
          }));
        results.push(...rootFiles);

        // 2. Project directories (Gemini style)
        for (const entry of entries) {
          if (entry.isDirectory() && !this.ignoredDirs.includes(entry.name)) {
            const projectPath = path.join(watchPath, entry.name);
            const sessionFiles: string[] = [];
            await this.collectSessions(projectPath, sessionFiles);

            results.push(...sessionFiles.map(file => ({
              filePath: file,
              projectName: entry.name,
              isChatGPT: false
            })));
          }
        }
      } catch (err) {
        console.error(`[DiscoveryService] Failed to scan ${watchPath}:`, err);
      }
    }

    return results;
  }

  /**
   * Recursively collect session files from a project directory
   */
  private async collectSessions(dir: string, files: string[]) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Look into subdirectories, but avoid known huge folders
          if (this.ignoredDirs.includes(entry.name)) continue;
          await this.collectSessions(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          if (this.isReservedConfig(entry.name)) continue;
          files.push(fullPath);
        }
      }
    } catch (e) {}
  }

  /**
   * Extract project name from a file path based on watch paths
   */
  resolveProjectName(filePath: string, watchPaths: string[]): string {
    const rootPath = watchPaths.find(p => filePath.startsWith(p));
    if (!rootPath) return 'Unknown';

    const relative = path.relative(rootPath, filePath);
    const parts = relative.split(path.sep);
    
    if (parts.length > 1) {
      return parts[0]; // First directory name is the project name
    }
    
    return 'Imported';
  }

  private isReservedConfig(filename: string): boolean {
    return ['package.json', 'package-lock.json', 'tsconfig.json', 'projects.json', 'vitest.config.ts'].includes(filename);
  }
}
