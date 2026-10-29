import Database from 'better-sqlite3';
import type { AnalyzedSession } from '../types/index.js';
import type { SessionStore } from './SessionStore.js';
import path from 'node:path';
import fs from 'node:fs';

export class SessionStorage implements SessionStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (dbPath !== ':memory:' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sessionId TEXT PRIMARY KEY,
        filePath TEXT,
        projectName TEXT,
        sessionTitle TEXT,
        modelId TEXT,
        category TEXT,
        provider TEXT,
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

    // Older databases predate the filePath column.
    const columns = this.db.prepare('PRAGMA table_info(sessions)').all() as {
      name: string;
    }[];
    if (!columns.some((column) => column.name === 'filePath')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN filePath TEXT');
    }
    this.db.exec(
      'CREATE INDEX IF NOT EXISTS idx_file_path ON sessions(filePath)',
    );
  }

  saveSession(session: AnalyzedSession) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (
        sessionId, filePath, projectName, sessionTitle, modelId, category, provider, startTime, lastUpdated, score, turns, tokensTotal, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.sessionId,
      session.filePath || null,
      session.projectName,
      session.sessionTitle || null,
      session.modelId,
      session.category,
      session.provider,
      session.startTime,
      session.lastUpdated,
      session.expressionQuality.score,
      session.stats.turns,
      session.stats.tokenUsage.total,
      JSON.stringify(session),
    );
  }

  deleteByFilePath(filePath: string): number {
    const result = this.db
      .prepare('DELETE FROM sessions WHERE filePath = ?')
      .run(filePath);
    return result.changes;
  }

  getSessions(
    query: { category?: string; limit?: number } = {},
  ): AnalyzedSession[] {
    let sql = 'SELECT * FROM sessions';
    const params: (string | number)[] = [];

    if (query.category) {
      sql += ' WHERE category = ?';
      params.push(query.category);
    }

    sql += ' ORDER BY startTime DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as { data: string }[];
    return rows.map((row) => JSON.parse(row.data) as AnalyzedSession);
  }

  getSessionById(sessionId: string): AnalyzedSession | null {
    const row = this.db
      .prepare('SELECT data FROM sessions WHERE sessionId = ?')
      .get(sessionId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as AnalyzedSession) : null;
  }

  getProjects(): string[] {
    const rows = this.db
      .prepare('SELECT DISTINCT projectName FROM sessions')
      .all() as { projectName: string }[];
    return rows.map((row) => row.projectName);
  }

  /** Returns the most recent 30 days, ascending. */
  getStatsTimeline(): { date: string; avgScore: number }[] {
    const sql = `
      SELECT 
        strftime('%Y-%m-%d', startTime) as date,
        AVG(score) as avgScore
      FROM sessions
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30
    `;
    const rows = this.db.prepare(sql).all() as {
      date: string;
      avgScore: number;
    }[];
    return rows
      .map((row) => ({
        date: row.date,
        avgScore: Math.round(row.avgScore),
      }))
      .reverse();
  }

  getModelStats(): {
    modelId: string;
    sessionCount: number;
    avgScore: number;
    avgTokens: number;
    avgTurns: number;
  }[] {
    const sql = `
      SELECT 
        modelId,
        COUNT(*) as sessionCount,
        AVG(score) as avgScore,
        AVG(tokensTotal) as avgTokens,
        AVG(turns) as avgTurns
      FROM sessions
      GROUP BY modelId
      ORDER BY avgScore DESC
    `;
    return this.db.prepare(sql).all() as {
      modelId: string;
      sessionCount: number;
      avgScore: number;
      avgTokens: number;
      avgTurns: number;
    }[];
  }

  close() {
    this.db.close();
  }
}
