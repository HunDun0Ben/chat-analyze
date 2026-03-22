/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - SQLite Storage Implementation
 */

import Database from 'better-sqlite3';
import { AnalyzedSession } from './types.js';
import path from 'node:path';
import fs from 'node:fs';

export class SessionStorage {
  private db: Database.Database;

  constructor(dbPath: string = './chat_analyze.db') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sessionId TEXT PRIMARY KEY,
        projectName TEXT,
        modelId TEXT,
        category TEXT,
        startTime TEXT,
        lastUpdated TEXT,
        score INTEGER,
        turns INTEGER,
        tokensTotal INTEGER,
        data TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_category ON sessions(category);
      CREATE INDEX IF NOT EXISTS idx_project ON sessions(projectName);
    `);
  }

  saveSession(session: AnalyzedSession) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (
        sessionId, projectName, modelId, category, startTime, lastUpdated, score, turns, tokensTotal, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.sessionId,
      session.projectName,
      session.modelId,
      session.category,
      session.startTime,
      session.lastUpdated,
      session.expressionQuality.score,
      session.stats.turns,
      session.stats.tokenUsage.total,
      JSON.stringify(session)
    );
  }

  getSessions(query: { category?: string; limit?: number } = {}) {
    let sql = 'SELECT * FROM sessions';
    const params: any[] = [];

    if (query.category) {
      sql += ' WHERE category = ?';
      params.push(query.category);
    }

    sql += ' ORDER BY startTime DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row: any) => JSON.parse(row.data) as AnalyzedSession);
  }

  close() {
    this.db.close();
  }
}
