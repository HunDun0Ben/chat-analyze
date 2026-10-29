import fsp from 'node:fs/promises';
import type { AnalyzedSession } from '../types/index.js';
import type { SessionStore } from '../db/SessionStore.js';
import type { ParseResult } from './parsing/result.js';
import type { DiscoveryService } from './services/DiscoveryService.js';
import type { ProjectResolver } from './services/ProjectResolver.js';
import { StatsService } from './stats/StatsService.js';
import { mapWithConcurrency } from './utils/concurrency.js';

/** Minimal analyzer contract, so tests can inject a counting fake. */
export interface SessionAnalyzerLike {
  analyze(filePath: string): Promise<ParseResult>;
}

/** Upper bound on files parsed at the same time (fd / memory safety). */
export const MAX_CONCURRENT_PARSES = 8;

export class SessionManager {
  private readonly sessions = new Map<string, AnalyzedSession>();
  /** filePath → sessionIds, used for re-parse replacement and deletion. */
  private readonly sessionsByFile = new Map<string, Set<string>>();
  /** filePath → "mtimeMs:size" for skipping unchanged files on re-init. */
  private readonly fingerprints = new Map<string, string>();
  private readonly stats = new StatsService();

  constructor(
    private readonly watchPaths: string[],
    private readonly analyzer: SessionAnalyzerLike,
    /** `null` while persistence is disabled: the SQLite design is kept but
     * the database file is never opened. */
    private readonly storage: SessionStore | null,
    private readonly discoveryService: DiscoveryService,
    private readonly projectResolver: ProjectResolver,
  ) {}

  /**
   * Reconciles memory with the filesystem. Unchanged files are reused on a
   * second call; files that disappeared are removed from memory (and from the
   * database when persistence is enabled).
   */
  async init(): Promise<void> {
    const startedAt = Date.now();
    console.log(
      `[Manager] Scanning directories: ${this.watchPaths.join(', ')}`,
    );

    const discovered = await this.discoveryService.scan(this.watchPaths);
    console.log(
      `[Manager] Discovered ${discovered.length} potential session files.`,
    );

    const scanned = new Set(discovered.map((item) => item.filePath));

    // Drop everything that no longer exists on disk.
    const knownPaths = new Set([
      ...this.sessionsByFile.keys(),
      ...this.fingerprints.keys(),
    ]);
    for (const filePath of knownPaths) {
      if (!scanned.has(filePath)) this.removeByPath(filePath);
    }

    const toParse: string[] = [];
    for (const item of discovered) {
      const fingerprint = await this.fingerprintOf(item.filePath);
      const unchanged =
        this.sessionsByFile.has(item.filePath) &&
        fingerprint !== undefined &&
        this.fingerprints.get(item.filePath) === fingerprint;

      if (!unchanged) toParse.push(item.filePath);
    }

    const results = await mapWithConcurrency(
      toParse,
      MAX_CONCURRENT_PARSES,
      (filePath) => this.analyzer.analyze(filePath),
    );

    for (const [index, result] of results.entries()) {
      const filePath = toParse[index];

      if (result.status === 'rejected') {
        console.error(`[Manager] Failed to parse ${filePath}:`, result.reason);
        continue;
      }

      const { sessions, warnings } = result.value;
      for (const warning of warnings) {
        console.warn(`[Manager] ${warning.filePath}: ${warning.reason}`);
      }

      // A re-parsed file may produce different session ids.
      this.removeSessionsForFile(filePath);
      for (const session of sessions) {
        await this.storeSession(session, filePath);
      }

      const fingerprint = await this.fingerprintOf(filePath);
      if (fingerprint) this.fingerprints.set(filePath, fingerprint);
    }

    console.log(
      `[Manager] Sync complete. ${this.sessions.size} valid sessions loaded ` +
        `(${toParse.length}/${discovered.length} files parsed) in ${Date.now() - startedAt}ms.`,
    );
  }

  // --- API Methods ---

  getProjects(provider?: 'gemini' | 'chatgpt'): string[] {
    return Array.from(this.sessions.values())
      .filter((s) => !provider || s.provider === provider)
      .map((s) => s.projectName)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
  }

  getSessionsByProject(projectName: string): AnalyzedSession[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.projectName === projectName)
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
  }

  getSession(sessionId: string): AnalyzedSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessions(): AnalyzedSession[] {
    return Array.from(this.sessions.values());
  }

  getStats(): { total: number; avgScore: number; totalTokens: number } {
    return this.stats.summary(this.getAllSessions());
  }

  /**
   * Single file update/add (used by the watcher). Replaces whatever was
   * previously indexed for that path.
   */
  async upsertFromFile(filePath: string): Promise<AnalyzedSession> {
    const result = await this.analyzer.analyze(filePath);

    for (const warning of result.warnings) {
      console.warn(`[Manager] ${warning.filePath}: ${warning.reason}`);
    }

    if (result.sessions.length === 0) {
      throw new Error(`No sessions found in ${filePath}`);
    }

    this.removeSessionsForFile(filePath);

    for (const session of result.sessions) {
      await this.storeSession(session, filePath);
    }

    const fingerprint = await this.fingerprintOf(filePath);
    if (fingerprint) this.fingerprints.set(filePath, fingerprint);

    return result.sessions[result.sessions.length - 1];
  }

  /** Removes a deleted file from memory, fingerprints and persistence. */
  removeByPath(filePath: string): void {
    this.removeSessionsForFile(filePath);
    this.fingerprints.delete(filePath);

    if (this.storage) {
      try {
        const removed = this.storage.deleteByFilePath(filePath);
        if (removed > 0) {
          console.log(
            `[Manager] Removed ${removed} persisted session(s) for ${filePath}`,
          );
        }
      } catch (err) {
        console.error(`[Manager] Failed to delete rows for ${filePath}:`, err);
      }
    }
  }

  private removeSessionsForFile(filePath: string): void {
    const sessionIds = this.sessionsByFile.get(filePath);
    if (!sessionIds) return;

    for (const sessionId of sessionIds) this.sessions.delete(sessionId);
    this.sessionsByFile.delete(filePath);
  }

  private async storeSession(
    session: AnalyzedSession,
    filePath: string,
  ): Promise<void> {
    if (!session.sessionId) {
      console.warn(`[Manager] Skipping session without id from ${filePath}`);
      return;
    }

    await this.applyProjectName(session, filePath);

    this.sessions.set(session.sessionId, session);

    const sessionIds = this.sessionsByFile.get(filePath) ?? new Set<string>();
    sessionIds.add(session.sessionId);
    this.sessionsByFile.set(filePath, sessionIds);

    this.persistSession(session);
  }

  /**
   * Applies the provider-specific project name when the parser produced a
   * placeholder. Shared by init() and upsertFromFile() so the name never
   * changes depending on how the session was loaded.
   */
  private async applyProjectName(
    session: AnalyzedSession,
    filePath: string,
  ): Promise<void> {
    const needsResolution =
      session.projectNameIsPlaceholder ??
      this.projectResolver.isPlaceholder(session.provider, session.projectName);

    if (!needsResolution) return;

    session.projectName = await this.projectResolver.resolve(
      session.provider,
      filePath,
      this.watchPaths,
    );
  }

  private persistSession(session: AnalyzedSession): void {
    if (!this.storage) return;

    try {
      this.storage.saveSession(session);
    } catch (err) {
      console.error(
        `[Manager] Failed to persist session ${session.sessionId}:`,
        err,
      );
    }
  }

  private async fingerprintOf(filePath: string): Promise<string | undefined> {
    try {
      const stat = await fsp.stat(filePath);
      return `${stat.mtimeMs}:${stat.size}`;
    } catch {
      return undefined;
    }
  }
}
