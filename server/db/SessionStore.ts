import { AnalyzedSession } from '../types/index.js';

/**
 * Persistence port used by `SessionManager`.
 *
 * The SQLite implementation is intentionally kept (`SessionStorage`) even
 * while writes are disabled: `PERSISTENCE=sqlite` switches the manager over
 * without touching call sites. When persistence is off the manager receives
 * `null` and never opens the database file.
 */
export interface SessionStore {
  saveSession(session: AnalyzedSession): void;
  /** Removes every row that belongs to a file (deleted or re-parsed). */
  deleteByFilePath(filePath: string): number;
  close(): void;
}
