/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Project-Centric Session Manager
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { SessionParser } from './parser.js';
import { AnalyzedSession } from './types.js';

export class SessionManager {
  private sessions: Map<string, AnalyzedSession> = new Map();
  private parser: SessionParser = new SessionParser();

  constructor(private watchPath: string) {}

  /**
   * 按 "Root -> Project Folder -> Sessions" 的层级初始化加载
   */
  async init() {
    console.log(`[Manager] Initializing from Root: ${this.watchPath}`);
    const startTime = Date.now();
    let totalLoaded = 0;

    try {
      // 1. 获取 Root 下的所有项
      const entries = await fs.readdir(this.watchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // 2. 每一个文件夹都是一个 Project
        if (entry.isDirectory()) {
          const projectName = entry.name;
          const projectPath = path.join(this.watchPath, projectName);
          
          // 排除系统级干扰
          if (projectName === 'node_modules' || projectName === '.git') continue;

          // 3. 扫描该项目下的所有会话 (可能在根部或 chats/ 子目录中)
          const sessionFiles: string[] = [];
          await this.collectSessions(projectPath, sessionFiles);

          if (sessionFiles.length > 0) {
            console.log(`[Manager] Project [${projectName}]: Found ${sessionFiles.length} sessions.`);
            for (const file of sessionFiles) {
              try {
                // 强制将文件夹名称作为项目名称注入
                const session = await this.parser.analyze(file);
                session.projectName = projectName; 
                
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
      console.error(`[Manager] Failed to read Root path:`, err);
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
          // 只深入一层 (通常是 chats/)，避免过度递归
          if (entry.name === 'chats') {
            await this.collectSessions(fullPath, files);
          }
        } else if (entry.isFile() && entry.name.startsWith('session-') && entry.name.endsWith('.json')) {
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
      
      // 从路径中提取项目名：~/.gemini/tmp/PROJECT_NAME/...
      const relative = path.relative(this.watchPath, filePath);
      const projectName = relative.split(path.sep)[0];
      
      session.projectName = projectName;
      this.sessions.set(session.sessionId, session);
      return session;
    } catch (err) {
      console.error(`[Manager] Upsert failed for ${filePath}:`, err);
      throw err;
    }
  }
}
