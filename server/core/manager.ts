import { SessionAnalyzer } from './parsing/SessionAnalyzer.js';
import { SessionStorage } from '../db/storage.js';
import { DiscoveryService } from './services/DiscoveryService.js';
import { ProjectResolver } from './services/ProjectResolver.js';
import { AnalyzedSession } from '../types/index.js';

export class SessionManager {
  private sessions: Map<string, AnalyzedSession> = new Map();
  private readonly watchPaths: string[];
  private readonly analyzer: SessionAnalyzer;
  private readonly storage: SessionStorage;
  private readonly discoveryService: DiscoveryService;
  private readonly projectResolver: ProjectResolver;

  constructor(
    watchPaths: string[],
    analyzer: SessionAnalyzer,
    storage: SessionStorage,
    discoveryService: DiscoveryService,
    projectResolver: ProjectResolver,
  ) {
    this.watchPaths = watchPaths;
    this.analyzer = analyzer;
    this.storage = storage;
    this.discoveryService = discoveryService;
    this.projectResolver = projectResolver;
  }

  /**
   * Initialize: Full Directory Scan (Source of Truth)
   * High-performance parallel scanning and parsing.
   */
  async init() {
    const startTime = Date.now();
    console.log(
      `[Manager] Scanning directories: ${this.watchPaths.join(', ')}`,
    );

    // 1. Scan filesystem
    const discovered = await this.discoveryService.scan(this.watchPaths);
    console.log(
      `[Manager] Discovered ${discovered.length} potential session files.`,
    );

    // 2. Clear old memory for fresh sync (Direct from directory)
    this.sessions.clear();

    // 3. Parallel parsing with allSettled to ensure 100% resilience
    const parseResults = await Promise.allSettled(
      discovered.map(async (item) => {
        const result = await this.analyzer.analyze(item.filePath);

        for (const session of result.sessions) {
          await this.applyProjectName(session, item.filePath);
        }

        return result;
      }),
    );

    // 4. Update memory and persistence
    for (const [index, result] of parseResults.entries()) {
      if (result.status === 'rejected') {
        console.error(
          `[Manager] Failed to parse ${discovered[index].filePath}:`,
          result.reason,
        );
        continue;
      }

      for (const warning of result.value.warnings) {
        console.warn(`[Manager] ${warning.filePath}: ${warning.reason}`);
      }

      for (const session of result.value.sessions) {
        if (!session.sessionId) {
          console.warn(
            `[Manager] Skipping session without id from ${discovered[index].filePath}`,
          );
          continue;
        }
        this.sessions.set(session.sessionId, session);
        this.persistSession(session);
      }
    }

    console.log(
      `[Manager] Sync complete. ${this.sessions.size} valid sessions loaded in ${Date.now() - startTime}ms.`,
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

  getStats() {
    const sessions = this.getAllSessions();
    if (sessions.length === 0) return { total: 0, avgScore: 0, totalTokens: 0 };

    return {
      total: sessions.length,
      avgScore:
        sessions.reduce((acc, s) => acc + s.expressionQuality.score, 0) /
        sessions.length,
      totalTokens: sessions.reduce(
        (acc, s) => acc + s.stats.tokenUsage.total,
        0,
      ),
    };
  }

  async refresh() {
    await this.init();
    return this.getAllSessions();
  }

  /**
   * Single file update/add (Used by Watcher)
   */
  async upsertFromFile(filePath: string): Promise<AnalyzedSession> {
    const result = await this.analyzer.analyze(filePath);

    for (const warning of result.warnings) {
      console.warn(`[Manager] ${warning.filePath}: ${warning.reason}`);
    }

    const sessions = result.sessions;
    if (sessions.length === 0) {
      throw new Error(`No sessions found in ${filePath}`);
    }

    // For single file, we take the last session or most relevant
    const session = sessions[sessions.length - 1];

    // Update memory
    for (const s of sessions) {
      if (!s.sessionId) {
        console.warn(`[Manager] Skipping session without id from ${filePath}`);
        continue;
      }
      await this.applyProjectName(s, filePath);
      this.sessions.set(s.sessionId, s);
      this.persistSession(s);
    }

    return session;
  }

  /**
   * Apply the provider-specific project name when the parser produced a
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
    try {
      this.storage.saveSession(session);
    } catch (err) {
      console.error(
        `[Manager] Failed to persist session ${session.sessionId}:`,
        err,
      );
    }
  }
}
