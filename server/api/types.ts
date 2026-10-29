import type { AnalyzedSession, StatsSummary } from '@chat-analyze/shared';
import type { StatsService } from '../core/stats/StatsService.js';

/** The slice of `SessionManager` the HTTP layer depends on. */
export interface SessionManagerLike {
  getAllSessions(): AnalyzedSession[];
  getSession(sessionId: string): AnalyzedSession | null;
  getProjects(provider?: 'gemini' | 'chatgpt'): string[];
  getSessionsByProject(projectName: string): AnalyzedSession[];
  getStats(): StatsSummary;
}

export interface AppDeps {
  manager: SessionManagerLike;
  /** Absolute directory where exported skills are written. */
  exportsDir: string;
}

export interface RouteDeps extends AppDeps {
  /** Shared, stateless aggregate implementation. */
  stats: StatsService;
}
