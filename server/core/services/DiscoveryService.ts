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
}

export class DiscoveryService {
  private readonly ignoredDirs = ['node_modules', '.git', 'exports', 'dist', 'build', 'logs'];

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
          .filter(e => !this.isIgnoredFile(e.name))
          .map(e => ({
            filePath: path.join(watchPath, e.name),
            projectName: 'Imported'
          }));
        results.push(...rootFiles);

        // 2. Project directories
        for (const entry of entries) {
          if (entry.isDirectory() && !this.isIgnoredDir(entry.name)) {
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
          if (this.isIgnoredDir(entry.name)) continue;
          await this.collectSessions(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          if (this.isReservedConfig(entry.name) || this.isIgnoredFile(entry.name)) continue;
          files.push(fullPath);
        }
      }
    } catch (e) {
      console.error(`Error collecting sessions from ${dir}:`, e);
    }
  }

  private isIgnoredDir(name: string): boolean {
    return (
      this.ignoredDirs.includes(name) || 
      name === 'community-plugins'
    );
  }

  private isIgnoredFile(name: string): boolean {
    const baseName = name.endsWith('.json') ? name.slice(0, -5) : name;
    return (
      baseName === 'community-plugins'
    );
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
      } catch {
        // Silently fail if directory read fails during project resolution
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }

    // 2. Fallback to first level directory name relative to watch root
    const relative = path.relative(rootPath, filePath);
    const dirParts = path.dirname(relative).split(path.sep);
    
    // If the file is directly under a project directory or a sub-directory like 'chats'
    if (dirParts.length > 0 && dirParts[0] !== '.') {
      // If the first part is 'chats', that's not a project name, try to get more context
      if (dirParts[0] === 'chats' && dirParts.length > 1) {
         return dirParts[1];
      }
      return dirParts[0];
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
