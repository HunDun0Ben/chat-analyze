/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Project-Centric Session Manager
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { SessionParser } from './parser.js';
import { AnalyzedSession } from '../types/index.js';

export class SessionManager {
  private sessions: Map<string, AnalyzedSession> = new Map();
  private parser: SessionParser = new SessionParser();

  constructor(private watchPaths: string[]) {}

  /**
   * 初始化所有监听路径
   */
  async init() {
    console.log(`[Manager] Initializing from ${this.watchPaths.length} watch paths.`);
    const startTime = Date.now();
    let totalLoaded = 0;

    for (const watchPath of this.watchPaths) {
      console.log(`[Manager] Scanning path: ${watchPath}`);
      try {
        const entries = await fs.readdir(watchPath, { withFileTypes: true });
        
        // 1. 处理直接位于根目录下的零散会话文件 (如 ChatGPT 导出)
        const rootFiles = entries
          .filter(e => e.isFile() && e.name.endsWith('.json') && !['package.json', 'package-lock.json', 'tsconfig.json'].includes(e.name))
          .map(e => path.join(watchPath, e.name));

        for (const file of rootFiles) {
          try {
            const session = await this.parser.analyze(file);
            if (session.projectName === 'Unknown') {
              session.projectName = 'Imported';
            }
            this.sessions.set(session.sessionId, session);
            totalLoaded++;
          } catch (err) {
            console.error(`[Manager] Error parsing root file ${file}:`, err);
          }
        }

        // 2. 处理传统的 Gemini 项目文件夹结构
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const projectName = entry.name;
            const projectPath = path.join(watchPath, projectName);
            
            if (['node_modules', '.git', 'exports'].includes(projectName)) continue;

            const sessionFiles: string[] = [];
            await this.collectSessions(projectPath, sessionFiles);

            if (sessionFiles.length > 0) {
              console.log(`[Manager] Project [${projectName}]: Found ${sessionFiles.length} sessions.`);
              for (const file of sessionFiles) {
                try {
                  const session = await this.parser.analyze(file);
                  // 智能项目命名：嵌套目录下的文件优先使用目录名，除非是 ChatGPT 导入
                  if (session.projectName === 'Unknown' || /^[a-f0-9]{64}$/.test(session.projectName) || session.projectHash !== 'chatgpt-import') {
                    session.projectName = projectName;
                  }
                  
                  this.sessions.set(session.sessionId, session);
                  totalLoaded++;
                } catch (err) {
                  console.error(`[Manager] Error parsing ${file}:`, err);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`[Manager] Failed to read path ${watchPath}:`, err);
      }
    }

    console.log(`[Manager] Initialization complete. ${totalLoaded} sessions across ${this.getProjects().length} projects in ${Date.now() - startTime}ms.`);
  }

  /**
   * 在项目文件夹内寻找 session 文件
   */
  private async collectSessions(dir: string, files: string[]) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'chats') {
            await this.collectSessions(fullPath, files);
          }
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          if (['package.json', 'package-lock.json', 'tsconfig.json'].includes(entry.name)) continue;
          files.push(fullPath);
        }
      }
    } catch (e) {}
  }

  // --- API Methods ---

  getProjects(): string[] {
    const projects = new Set<string>();
    for (const session of this.sessions.values()) {
      projects.add(session.projectName);
    }
    return Array.from(projects).sort();
  }

  getSessionsByProject(projectName: string): AnalyzedSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.projectName === projectName)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  getSessionById(sessionId: string): AnalyzedSession | undefined {
    return this.sessions.get(sessionId);
  }

  getStatsTimeline(): { date: string; avgScore: number }[] {
    const daily: Record<string, { total: number; count: number }> = {};
    for (const session of this.sessions.values()) {
      const date = session.startTime.split('T')[0];
      if (!daily[date]) daily[date] = { total: 0, count: 0 };
      daily[date].total += session.expressionQuality.score;
      daily[date].count++;
    }
    return Object.entries(daily)
      .map(([date, data]) => ({ date, avgScore: Math.round(data.total / data.count) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }

  getModelStats(): any[] {
    const stats: Record<string, { sessionCount: number; totalScore: number; totalTokens: number; totalTurns: number }> = {};
    for (const session of this.sessions.values()) {
      const mId = session.modelId;
      if (!stats[mId]) stats[mId] = { sessionCount: 0, totalScore: 0, totalTokens: 0, totalTurns: 0 };
      stats[mId].sessionCount++;
      stats[mId].totalScore += session.expressionQuality.score;
      stats[mId].totalTokens += session.stats.tokenUsage.total;
      stats[mId].totalTurns += session.stats.turns;
    }
    return Object.entries(stats)
      .map(([modelId, data]) => ({
        modelId,
        sessionCount: data.sessionCount,
        avgScore: Math.round(data.totalScore / data.sessionCount),
        avgTokens: Math.round(data.totalTokens / data.sessionCount),
        avgTurns: Math.round(data.totalTurns / data.sessionCount)
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  /**
   * Watcher 调用此方法时，根据路径提取 Project Name
   */
  async upsertFromFile(filePath: string) {
    try {
      const session = await this.parser.analyze(filePath);
      
      // 确定该文件属于哪个根目录
      const rootPath = this.watchPaths.find(p => filePath.startsWith(p));
      if (rootPath) {
        const relative = path.relative(rootPath, filePath);
        const parts = relative.split(path.sep);
        
        // 如果在子目录中
        if (parts.length > 1) {
          const projectName = parts[0];
          if (session.projectName === 'Unknown' || /^[a-f0-9]{64}$/.test(session.projectName) || session.projectHash !== 'chatgpt-import') {
            session.projectName = projectName;
          }
        } else {
          // 在根目录下，如果没名字则标记为 Imported
          if (session.projectName === 'Unknown') {
            session.projectName = 'Imported';
          }
        }
      }
      
      this.sessions.set(session.sessionId, session);
      return session;
    } catch (err) {
      console.error(`[Manager] Upsert failed for ${filePath}:`, err);
      throw err;
    }
  }
}
