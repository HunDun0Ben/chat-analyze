import {
  AnalyzedSession,
  SessionMessage,
  ToolCall,
} from '../../types/index.js';
import { BaseParser } from './BaseParser.js';
import { CoachService } from '../services/CoachService.js';
import { ParserOutput, ParseWarning } from '../parsing/result.js';
import { SessionSource } from '../parsing/source.js';
import { resolveSessionId, stableMessageId } from '../parsing/shared/ids.js';
import {
  describeZodError,
  jsonlMetadataSchema,
  jsonlRecordSchema,
  jsonlSetEventSchema,
} from './schemas.js';

/**
 * Only metadata keys may be updated by a `$set` record. Anything else (most
 * importantly `messages` / `sessionId`) would let a malformed log line rewrite
 * the session being aggregated.
 */
const ALLOWED_SET_KEYS = new Set(['lastUpdated', 'sessionTitle', 'modelId']);

export class GeminiJsonlParser extends BaseParser {
  constructor(coachService: CoachService) {
    super(coachService);
  }

  async parse(source: SessionSource): Promise<ParserOutput> {
    const { filePath } = source;
    // No metadata timestamps in a bare JSONL: fall back to the file mtime so
    // repeated parses of the same file are byte-for-byte identical.
    const fallbackTimestamp = new Date(source.stat.mtimeMs).toISOString();
    const warnings: ParseWarning[] = [];

    const messages: SessionMessage[] = [];
    let userTurns = 0;
    let geminiTurns = 0;
    let projectHash = '';
    let startTime = fallbackTimestamp;
    let lastUpdated = fallbackTimestamp;
    let modelId = 'unknown';
    const toolChain: string[] = [];
    const tokenUsage = { input: 0, output: 0, thoughts: 0, total: 0 };

    let isFirstLine = true;
    let lineNumber = 0;
    let metadataSessionId: string | undefined;
    let ignoredSetKeys = 0;
    let explicitTitle: string | undefined;

    for await (const line of source.lines()) {
      lineNumber++;
      if (line.trim().length === 0) continue;

      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch (error) {
        if (warnings.length < 100) {
          warnings.push({
            filePath,
            reason: `line ${lineNumber}: ${(error as Error).message}`,
          });
        }
        continue;
      }

      if (isFirstLine) {
        const meta = jsonlMetadataSchema.safeParse(raw);
        if (!meta.success) {
          warnings.push({
            filePath,
            reason: `line ${lineNumber}: ${describeZodError(meta.error)}`,
          });
        } else {
          if (meta.data.sessionId) metadataSessionId = meta.data.sessionId;
          if (meta.data.projectHash) projectHash = meta.data.projectHash;
          if (meta.data.startTime) startTime = meta.data.startTime;
          if (meta.data.lastUpdated) lastUpdated = meta.data.lastUpdated;
        }
        isFirstLine = false;
        continue;
      }

      const setParsed = jsonlSetEventSchema.safeParse(raw);
      if (setParsed.success) {
        // Metadata-only update: ignore every key outside the whitelist
        // instead of blind Object.assign.
        const setEvent = setParsed.data.$set;
        for (const key of Object.keys(setEvent)) {
          if (!ALLOWED_SET_KEYS.has(key)) ignoredSetKeys++;
        }
        if (typeof setEvent.lastUpdated === 'string') {
          lastUpdated = setEvent.lastUpdated;
        }
        if (typeof setEvent.sessionTitle === 'string') {
          explicitTitle = setEvent.sessionTitle;
        }
        if (typeof setEvent.modelId === 'string') {
          modelId = setEvent.modelId;
        }
        continue;
      }

      const parsed = jsonlRecordSchema.safeParse(raw);
      if (!parsed.success) {
        if (warnings.length < 100) {
          warnings.push({
            filePath,
            reason: `line ${lineNumber}: ${describeZodError(parsed.error)}`,
          });
        }
        continue;
      }

      const record = parsed.data;
      const msg: SessionMessage = {
        id: record.id || stableMessageId(filePath, lineNumber),
        timestamp: record.timestamp || fallbackTimestamp,
        type: record.type,
        content: '',
      };

      if (record.type === 'user') {
        msg.content = (record.content ?? [])
          .map((part) => (typeof part === 'string' ? part : (part.text ?? '')))
          .join('\n');
        userTurns++;
      } else if (record.type === 'gemini') {
        msg.content = record.content ?? '';
        msg.model = record.model;
        geminiTurns++;

        if (record.thoughts && record.thoughts.length > 0) {
          msg.thoughts = record.thoughts.map((thought) => ({
            subject: thought.subject ?? '',
            description: thought.description ?? '',
            timestamp: msg.timestamp,
          }));
        }

        if (record.toolCalls && record.toolCalls.length > 0) {
          msg.toolCalls = record.toolCalls.map((tc) => {
            const toolCall: ToolCall = {
              id: tc.id ?? '',
              name: tc.name,
              args: tc.args ?? {},
              status: tc.status ?? 'pending',
              timestamp: tc.timestamp ?? msg.timestamp,
            };
            if (tc.result?.functionResponse) {
              toolCall.result = tc.result.functionResponse.response;
              toolCall.status = 'success'; // Assume success if result is present
            }
            toolChain.push(tc.name);
            return toolCall;
          });
        }

        if (record.tokens) {
          tokenUsage.input += record.tokens.input ?? 0;
          tokenUsage.output += record.tokens.output ?? 0;
          tokenUsage.thoughts += record.tokens.thoughts ?? 0;
          tokenUsage.total += record.tokens.total ?? 0;
        }
      } else {
        msg.content = record.content ?? '';
      }

      messages.push(msg);
    }

    if (ignoredSetKeys > 0) {
      console.warn(
        `[GeminiJsonlParser] Ignored ${ignoredSetKeys} unsupported $set key(s) in ${filePath}`,
      );
    }

    const geminiMsgs = messages.filter((m) => m.type === 'gemini');
    if (geminiMsgs.length > 0) {
      modelId = geminiMsgs[geminiMsgs.length - 1].model || 'unknown';
    }

    const firstUserMessage = messages.find((m) => m.type === 'user');
    const sessionTitle =
      explicitTitle ||
      firstUserMessage?.content?.substring(0, 50) ||
      'Untitled Session';

    const firstPrompt = firstUserMessage?.content || '';
    const correctionCount = this.coachService.countCorrections(
      messages.filter((m) => m.type === 'user'),
      messages,
    );

    const session: AnalyzedSession = {
      sessionId: resolveSessionId({ sessionId: metadataSessionId }, filePath),
      projectName: 'Imported', // Default, resolved later by ProjectResolver
      projectNameIsPlaceholder: true,
      sessionTitle,
      projectHash,
      modelId,
      category: this.coachService.detectCategory(firstPrompt, toolChain),
      provider: 'gemini',
      startTime,
      lastUpdated,
      expressionQuality: {
        scoreable: userTurns > 0,
        score: this.coachService.calculateQualityScore(
          correctionCount,
          firstPrompt,
        ),
        ambiguities: this.coachService.detectAmbiguities(firstPrompt),
        suggestion: this.coachService.generateSuggestion(firstPrompt),
      },
      stats: {
        turns: messages.length, // includes info messages, unlike the JSON parser
        userTurns,
        geminiTurns,
        corrections: correctionCount,
        toolChain,
        tokenUsage,
      },
      messages,
      filePath,
    };

    return { sessions: [session], warnings };
  }
}
