import { SessionMessage } from '../../types/index.js';
import { BaseParser } from './BaseParser.js';
import { ParserOutput } from '../parsing/result.js';
import { SessionSource } from '../parsing/source.js';
import { extractContent } from '../parsing/shared/content.js';
import { resolveSessionId, stableMessageId } from '../parsing/shared/ids.js';
import { toIsoTimestamp } from '../parsing/shared/time.js';
import { describeZodError, geminiSessionSchema } from './schemas.js';

export class GeminiParser extends BaseParser {
  async parse(source: SessionSource): Promise<ParserOutput> {
    const { filePath } = source;
    const parsed = geminiSessionSchema.safeParse(await source.readJson());

    if (!parsed.success) {
      throw new Error(
        `Not a valid Gemini session: ${describeZodError(parsed.error)}`,
      );
    }

    const s = parsed.data;
    const fallbackTimestamp = new Date(source.stat.mtimeMs).toISOString();

    const messages: SessionMessage[] = s.messages.map((m, index) => {
      const msg: SessionMessage = {
        id: m.id || stableMessageId(filePath, index),
        timestamp: toIsoTimestamp(m.timestamp, fallbackTimestamp),
        type: m.type === 'user' || m.type === 'gemini' ? m.type : 'info',
        content: extractContent(m.content),
        model: m.model,
        displayContent: extractContent(m.displayContent) || undefined,
      };

      if (m.thoughts && m.thoughts.length > 0) {
        msg.thoughts = m.thoughts.map((thought) => ({
          subject: thought.subject ?? '',
          description: thought.description ?? '',
          timestamp: thought.timestamp ?? '',
        }));
      }

      if (m.toolCalls && m.toolCalls.length > 0) {
        msg.toolCalls = m.toolCalls.map((toolCall) => ({
          id: toolCall.id ?? '',
          name: toolCall.name ?? '',
          args: toolCall.args ?? {},
          result: toolCall.result,
          status: toolCall.status ?? 'pending',
          timestamp: toolCall.timestamp ?? '',
          description: toolCall.description,
        }));
      }

      return msg;
    });

    const userMsgs = messages.filter((m) => m.type === 'user');
    const geminiMsgs = messages.filter((m) => m.type === 'gemini');

    const toolChain = messages
      .flatMap((m) => m.toolCalls || [])
      .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
      .map((tc) => tc.name);

    const tokenUsage = s.messages.reduce(
      (
        acc: { input: number; output: number; thoughts: number; total: number },
        m,
      ) => {
        if (m.type === 'gemini' && m.tokens) {
          acc.input += m.tokens.input ?? 0;
          acc.output += m.tokens.output ?? 0;
          acc.thoughts += m.tokens.thoughts ?? 0;
          acc.total += m.tokens.total ?? 0;
        }
        return acc;
      },
      { input: 0, output: 0, thoughts: 0, total: 0 },
    );

    const firstPrompt = userMsgs[0]?.content || '';
    const category = this.coachService.detectCategory(firstPrompt, toolChain);
    const correctionCount = this.coachService.countCorrections(
      userMsgs,
      messages,
    );

    // Project naming from session content only. Path-based fallbacks are
    // applied after parsing by ProjectResolver, so every provider uses the
    // same resolution path.
    const projectName = s.projectName || s.projectHash || 'Unknown';

    return {
      sessions: [
        {
          sessionId: resolveSessionId(s, filePath),
          projectName,
          sessionTitle: firstPrompt.substring(0, 50),
          projectHash: s.projectHash ?? '',
          modelId: geminiMsgs[geminiMsgs.length - 1]?.model || 'unknown',
          category,
          provider: 'gemini',
          startTime: s.startTime || fallbackTimestamp,
          lastUpdated: s.lastUpdated || fallbackTimestamp,
          expressionQuality: {
            score: this.coachService.calculateQualityScore(
              correctionCount,
              firstPrompt,
            ),
            ambiguities: this.coachService.detectAmbiguities(firstPrompt),
            suggestion: this.coachService.generateSuggestion(firstPrompt),
          },
          stats: {
            turns: userMsgs.length + geminiMsgs.length,
            userTurns: userMsgs.length,
            geminiTurns: geminiMsgs.length,
            corrections: correctionCount,
            toolChain,
            tokenUsage,
          },
          messages,
          filePath,
        },
      ],
      warnings: [],
    };
  }
}
