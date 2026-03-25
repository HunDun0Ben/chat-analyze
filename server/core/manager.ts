/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Optimized Session Manager (Filesystem-First)
 */

import path from 'node:path';
import { SessionParser } from './parser';
import { SessionStorage } from '../db/storage';
import { DiscoveryService } from './services/DiscoveryService';
import { AnalyzedSession } from '../types';

export class SessionManager {
  private sessions: Map<string, AnalyzedSession> = new Map();
  private readonly watchPaths: string[];
  private readonly parser: SessionParser;
  private readonly storage: SessionStorage;
  private readonly discoveryService: DiscoveryService;

  constructor(watchPaths: string[], parser: SessionParser, storage: SessionStorage, discoveryService: DiscoveryService) {
    this.watchPaths = watchPaths;
    this.parser = parser;
    this.storage = storage;
    this.discoveryService = discoveryService;
  }

  /**
   * Initialize: Full Directory Scan (Source of Truth)
   * High-performance parallel scanning and parsing.
   */
  async init() {
    const startTime = Date.now();
    console.log(`[Manager] Scanning directories: ${this.watchPaths.join(', ')}`);

    // 1. Scan filesystem
    const discovered = await this.discoveryService.scan(this.watchPaths);
    console.log(`[Manager] Discovered ${discovered.length} potential session files.`);

    // 2. Clear old memory for fresh sync (Direct from directory)
    this.sessions.clear();

    // 3. Parallel parsing with allSettled to ensure 100% resilience
    const parseResults = await Promise.allSettled(discovered.map(async (item) => {
      const result = await this.parser.analyze(item.filePath);
      const sessions = Array.isArray(result) ? result : [result];
      
      return sessions.map(session => {
        // Smart project naming fallback
        if (session.projectName === 'Imported' || session.projectName === 'Unknown' || session.projectName === 'ChatGPT Import' || /^[a-f0-9]{64}$/.test(session.projectName)) {
          session.projectName = item.projectName;
        }
        return session;
      });
    }));
    
    // 4. Update memory and persistence
    for (const result of parseResults) {
      if (result.status === 'fulfilled' && result.value) {
        for (const session of result.value) {
          this.sessions.set(session.sessionId, session);
          this.storage.saveSession(session);
        }
      }
    }

    console.log(`[Manager] Sync complete. ${this.sessions.size} valid sessions loaded in ${Date.now() - startTime}ms.`);
  }

  // --- API Methods ---

  getProjects(provider?: 'gemini' | 'chatgpt'): string[] {
    return Array.from(this.sessions.values())
      .filter(s => !provider || s.provider === provider)
      .map(s => s.projectName)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
  }

  getSessionsByProject(projectName: string): AnalyzedSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.projectName === projectName)
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
  }

  getSession(sessionId: string): AnalyzedSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessions(): AnalyzedSession[] {
    return Array.from(this.sessions.values());
  }

  getStats() {
    const sessions = this.getAllSessions();
    if (sessions.length === 0) return { total: 0, avgScore: 0, totalTokens: 0 };
    
    return {
      total: sessions.length,
      avgScore: sessions.reduce((acc, s) => acc + s.expressionQuality.score, 0) / sessions.length,
      totalTokens: sessions.reduce((acc, s) => acc + s.stats.tokenUsage.total, 0),
    };
  }

  async refresh() {
    await this.init();
    return this.getAllSessions();
  }
}
