import { CoachService } from '../services/CoachService.js';
import { GeminiJsonlParser } from '../parsers/GeminiJsonlParser.js';
import { BaseParser } from '../parsers/BaseParser.js';
import { PARSER_REGISTRATIONS } from './registry.js';
import { ParseResult, ParseWarning } from './result.js';
import {
  createFileSource,
  createMemorySource,
  SessionSource,
} from './source.js';

/**
 * Single entry point for turning a file on disk into sessions.
 *
 * Always returns a `ParseResult`: unsupported or broken input becomes a
 * warning instead of an exception, so a bad file can never abort a scan.
 */
export class SessionAnalyzer {
  private readonly coachService: CoachService;
  private readonly parsers = new Map<string, BaseParser>();
  private readonly geminiJsonlParser: GeminiJsonlParser;

  constructor() {
    this.coachService = new CoachService();
    for (const registration of PARSER_REGISTRATIONS) {
      this.parsers.set(
        registration.format,
        registration.create(this.coachService),
      );
    }
    this.geminiJsonlParser = new GeminiJsonlParser(this.coachService);
  }

  async analyze(filePath: string): Promise<ParseResult> {
    return this.analyzeSource(await createFileSource(filePath));
  }

  async analyzeSource(source: SessionSource): Promise<ParseResult> {
    try {
      if (source.fileName.endsWith('.jsonl')) {
        return await this.geminiJsonlParser.parse(source);
      }

      const data = await source.readJson();
      if (Array.isArray(data)) {
        return await this.analyzeArray(source, data);
      }

      const parser = this.getParser(data);
      if (!parser) throw new Error('Unsupported session format');
      return await parser.parse(source);
    } catch (error) {
      return {
        sessions: [],
        warnings: [
          { filePath: source.filePath, reason: (error as Error).message },
        ],
      };
    }
  }

  /**
   * Multi-session files (ChatGPT bulk exports) are dispatched entry by entry,
   * so one bad entry does not discard the whole file.
   */
  private async analyzeArray(
    source: SessionSource,
    items: unknown[],
  ): Promise<ParseResult> {
    const sessions: ParseResult['sessions'] = [];
    const warnings: ParseWarning[] = [];

    for (const [index, item] of items.entries()) {
      const parser = this.getParser(item);
      if (!parser) {
        warnings.push({
          filePath: source.filePath,
          reason: `entry ${index}: unsupported session format`,
        });
        continue;
      }

      const entrySource = createMemorySource({
        filePath: source.filePath,
        fileName: source.fileName,
        data: item,
        index,
        mtimeMs: source.stat.mtimeMs,
      });

      try {
        const output = await parser.parse(entrySource);
        sessions.push(...output.sessions);
        warnings.push(...output.warnings);
      } catch (error) {
        warnings.push({
          filePath: source.filePath,
          reason: `entry ${index}: ${(error as Error).message}`,
        });
      }
    }

    return { sessions, warnings };
  }

  /** Finds the first registered parser that accepts the payload. */
  private getParser(payload: unknown): BaseParser | null {
    for (const registration of PARSER_REGISTRATIONS) {
      if (!registration.canParse(payload)) continue;
      return this.parsers.get(registration.format) ?? null;
    }
    return null;
  }

  getCoachService(): CoachService {
    return this.coachService;
  }
}
