import { CoachService } from '../services/CoachService.js';
import { GeminiParser } from '../parsers/GeminiParser.js';
import { ChatGPTParser } from '../parsers/ChatGPTParser.js';
import { GeminiCheckpointParser } from '../parsers/GeminiCheckpointParser.js';
import { GeminiJsonlParser } from '../parsers/GeminiJsonlParser.js';
import { BaseParser } from '../parsers/BaseParser.js';
import { ParseResult, ParseWarning } from './result.js';
import {
  createFileSource,
  createMemorySource,
  SessionSource,
} from './source.js';
import { isRecord } from './shared/guards.js';

/**
 * Single entry point for turning a file on disk into sessions.
 *
 * Always returns a `ParseResult`: unsupported or broken input becomes a
 * warning instead of an exception, so a bad file can never abort a scan.
 */
export class SessionAnalyzer {
  private readonly coachService: CoachService;
  private readonly geminiParser: GeminiParser;
  private readonly chatGPTParser: ChatGPTParser;
  private readonly geminiCheckpointParser: GeminiCheckpointParser;
  private readonly geminiJsonlParser: GeminiJsonlParser;

  constructor() {
    this.coachService = new CoachService();
    this.geminiParser = new GeminiParser(this.coachService);
    this.chatGPTParser = new ChatGPTParser(this.coachService);
    this.geminiCheckpointParser = new GeminiCheckpointParser(this.coachService);
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
      if (!parser) throw new Error('Could not determine session format');
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

  /**
   * Detects session format based on JSON structure.
   * Format detection will move to a provider registry in a follow-up.
   */
  private getParser(session: unknown): BaseParser | null {
    if (!isRecord(session)) return null;
    const s = session;
    // Detect ChatGPT export format
    if (s.mapping && (s.conversation_id || s.id)) {
      return this.chatGPTParser;
    }

    // Detect Gemini API History (Checkpoint) format
    if (s.history && Array.isArray(s.history)) {
      return this.geminiCheckpointParser;
    }

    // Default to Gemini parser
    return this.geminiParser;
  }

  getCoachService(): CoachService {
    return this.coachService;
  }
}
