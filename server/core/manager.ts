/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Project-Centric Session Manager
 */

import { SessionParser } from './parser.js';
import { DiscoveryService } from './services/DiscoveryService.js';
import { SessionStorage } from '../db/storage.js';
import { AnalyzedSession } from '../types/index.js';

export class SessionManager {
  private sessions: Map<string, AnalyzedSession> = new Map();
  private parser: SessionParser = new SessionParser();
  private discoveryService: DiscoveryService = new DiscoveryService();
  private storage: SessionStorage;

  constructor(private watchPaths: string[]) {
    this.storage = new SessionStorage();
  }

  /**
   * 初始化所有监听路径并加载会话
   */
  async init() {
    console.log(`[Manager] Initializing from ${this.watchPaths.length} watch paths.`);
    const startTime = Date.now();

    // 1. 从数据库加载现有会话
    try {
      const dbSessions = this.storage.getSessions();
      for (const s of dbSessions) {
        this.sessions.set(s.sessionId, s);
      }
      console.log(`[Manager] Loaded ${this.sessions.size} sessions from database.`);
    } catch (err) {
      console.error('[Manager] Failed to load sessions from database:', err);
    }

    // 2. 扫描文件系统以查找新会话或更新
    const discovered = await this.discoveryService.scan(this.watchPaths);
    console.log(`[Manager] Discovered ${discovered.length} potential session files.`);

    let newOrUpdated = 0;
    for (const item of discovered) {
      try {
        const session = await this.parser.analyze(item.filePath);
        
        // 智能项目命名：如果解析器没识别出来，使用发现服务提供的名字
        if (session.projectName === 'Imported' || session.projectName === 'Unknown' || /^[a-f0-9]{64}$/.test(session.projectName)) {
           session.projectName = item.projectName;
        }

        const existing = this.sessions.get(session.sessionId);
        if (!existing || existing.lastUpdated !== session.lastUpdated) {
          this.storage.saveSession(session);
          this.sessions.set(session.sessionId, session);
          newOrUpdated++;
        }
      } catch (err) {
        // 忽略非 session 的 JSON 文件
      }
    }

    console.log(`[Manager] Initialization complete. ${newOrUpdated} sessions updated. Total: ${this.sessions.size} in ${Date.now() - startTime}ms.`);
  }

  // --- API Methods ---

  getProjects(): string[] {
    return this.storage.getProjects().sort();
  }

  getSessionsByProject(projectName: string): AnalyzedSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.projectName === projectName)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  getSessionById(sessionId: string): AnalyzedSession | undefined {
    return this.sessions.get(sessionId) || this.storage.getSessionById(sessionId) || undefined;
  }

  getStatsTimeline(): { date: string; avgScore: number }[] {
    return this.storage.getStatsTimeline();
  }

  getModelStats(): any[] {
    return this.storage.getModelStats();
  }

  /**
   * 当监听到文件变动时调用
   */
  async upsertFromFile(filePath: string) {
    try {
      const session = await this.parser.analyze(filePath);
      const projectName = await this.discoveryService.resolveProjectName(filePath, this.watchPaths);
      
      // 保持项目名称一致性
      if (session.projectName === 'Imported' || session.projectName === 'Unknown' || /^[a-f0-9]{64}$/.test(session.projectName)) {
        session.projectName = projectName;
      }
      
      this.storage.saveSession(session);
      this.sessions.set(session.sessionId, session);
      return session;
    } catch (err) {
      console.error(`[Manager] Upsert failed for ${filePath}:`, err);
      throw err;
    }
  }
}
