/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Discovery Service
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface DiscoveryResult {
  filePath: string;
  projectName: string;
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
        
        // 1. Root level files
        const rootFiles = entries
          .filter(e => e.isFile() && e.name.endsWith('.json') && !this.isReservedConfig(e.name))
          .map(e => ({
            filePath: path.join(watchPath, e.name),
            projectName: 'Imported'
          }));
        results.push(...rootFiles);

        // 2. Project directories
        for (const entry of entries) {
          if (entry.isDirectory() && !this.ignoredDirs.includes(entry.name)) {
            const projectPath = path.join(watchPath, entry.name);
            const sessionFiles: string[] = [];
            await this.collectSessions(projectPath, sessionFiles);

            for (const file of sessionFiles) {
              const projectName = await this.resolveProjectName(file, [watchPath]);
              results.push({
                filePath: file,
                projectName
              });
            }
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
   * Extract project name from a file path based on watch paths.
   * Supports .project_root or projects.json markers for deep projects.
   */
  async resolveProjectName(filePath: string, watchPaths: string[]): Promise<string> {
    const rootPath = watchPaths.find(p => filePath.startsWith(p));
    if (!rootPath) return 'Unknown';

    // 1. Look for .project_root or projects.json markers upwards
    let currentDir = path.dirname(filePath);
    while (currentDir.startsWith(rootPath) && currentDir !== rootPath) {
      try {
        const markerExists = await this.hasMarker(currentDir);
        if (markerExists) {
          return path.basename(currentDir);
        }
      } catch (e) {}
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }

    // 2. Fallback to first-level directory
    const relative = path.relative(rootPath, filePath);
    const parts = relative.split(path.sep);
    
    if (parts.length > 1) {
      return parts[0]; 
    }
    
    return 'Imported';
  }

  private async hasMarker(dir: string): Promise<boolean> {
    try {
      const files = await fs.readdir(dir);
      return files.includes('.project_root') || files.includes('projects.json');
    } catch {
      return false;
    }
  }

  private isReservedConfig(filename: string): boolean {
    return ['package.json', 'package-lock.json', 'tsconfig.json', 'projects.json', 'vitest.config.ts'].includes(filename);
  }
}
