import path from 'node:path';
import { AnalyzedSession, SessionMessage } from '../../types/index.js';
import { BaseParser, ParserOptions } from './BaseParser.js';

export class GeminiParser extends BaseParser {
  async analyze(
    session: unknown,
    options: ParserOptions,
  ): Promise<AnalyzedSession> {
    const { filePath } = options;
    const s = session as Record<string, unknown>;

    if (!s || !Array.isArray(s.messages)) {
      throw new Error('Not a valid Gemini session: Missing "messages" array');
    }

    const messages: SessionMessage[] = (
      s.messages as Record<string, unknown>[]
    ).map((m: Record<string, unknown>) => {
      const msg: SessionMessage = {
        id: (m.id as string) || '',
        timestamp: (m.timestamp as string) || '',
        type: (m.type as 'user' | 'gemini' | 'info') || 'info',
        content: this.extractContent(m.content),
        model: m.model as string | undefined,
        displayContent: this.extractContent(m.displayContent) || undefined,
      };

      if (m.thoughts) {
        msg.thoughts = (m.thoughts as Record<string, unknown>[]).map(
          (t: Record<string, unknown>) => ({
            subject: (t.subject as string) || '',
            description: (t.description as string) || '',
            timestamp: (t.timestamp as string) || '',
          }),
        );
      }

      if (m.toolCalls) {
        msg.toolCalls = (m.toolCalls as Record<string, unknown>[]).map(
          (tc: Record<string, unknown>) => ({
            id: (tc.id as string) || '',
            name: (tc.name as string) || '',
            args: (tc.args as Record<string, unknown>) || {},
            result: tc.result,
            status:
              (tc.status as 'success' | 'failure' | 'pending') || 'pending',
            timestamp: (tc.timestamp as string) || '',
            description: tc.description as string | undefined,
          }),
        );
      }

      return msg;
    });

    const userMsgs = messages.filter((m) => m.type === 'user');
    const geminiMsgs = messages.filter((m) => m.type === 'gemini');

    const toolChain = messages
      .flatMap((m) => m.toolCalls || [])
      .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
      .map((tc) => tc.name);

    const tokenUsage = (s.messages as Record<string, unknown>[]).reduce(
      (
        acc: { input: number; output: number; thoughts: number; total: number },
        m: Record<string, unknown>,
      ) => {
        const tokens = m.tokens as Record<string, number> | undefined;
        if (m.type === 'gemini' && tokens) {
          acc.input += tokens.input || 0;
          acc.output += tokens.output || 0;
          acc.thoughts += tokens.thoughts || 0;
          acc.total += tokens.total || 0;
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

    // Smart project naming: fallback to file path if name is a hash or missing
    let projectName =
      (s.projectName as string) || (s.projectHash as string) || 'Unknown';
    if (/^[a-f0-9]{64}$/.test(projectName) || projectName === 'Unknown') {
      const parts = filePath.split(path.sep);
      const chatsIdx = parts.lastIndexOf('chats');
      if (chatsIdx > 1) {
        // Path: .../<ProjectName>/chats/session.json
        projectName = parts[chatsIdx - 1];
      } else if (parts.length >= 2) {
        projectName = parts[parts.length - 2];
      }
    }

    return {
      sessionId: (s.sessionId as string) || '',
      projectName,
      sessionTitle: firstPrompt.substring(0, 50),
      projectHash: (s.projectHash as string) || '',
      modelId: geminiMsgs[geminiMsgs.length - 1]?.model || 'unknown',
      category,
      provider: 'gemini',
      startTime: (s.startTime as string) || '',
      lastUpdated: (s.lastUpdated as string) || '',
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
    };
  }
}
