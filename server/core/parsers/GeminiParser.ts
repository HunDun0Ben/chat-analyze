/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Gemini Session Parser
 */

import path from 'node:path';
import { 
  AnalyzedSession, 
  SessionMessage 
} from '../../types/index.js';
import { BaseParser, ParserOptions } from './BaseParser.js';

export class GeminiParser extends BaseParser {
  async analyze(session: any, options: ParserOptions): Promise<AnalyzedSession> {
    const { filePath } = options;

    if (!Array.isArray(session.messages)) {
      throw new Error('Not a valid Gemini session: Missing "messages" array');
    }

    const messages: SessionMessage[] = session.messages.map((m: any) => {
      const msg: SessionMessage = {
        id: m.id,
        timestamp: m.timestamp,
        type: m.type,
        content: this.extractContent(m.content),
        model: m.model,
        displayContent: this.extractContent(m.displayContent) || undefined,
      };

      if (m.thoughts) {
        msg.thoughts = m.thoughts.map((t: any) => ({
          subject: t.subject,
          description: t.description,
          timestamp: t.timestamp
        }));
      }

      if (m.toolCalls) {
        msg.toolCalls = m.toolCalls.map((tc: any) => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
          result: tc.result,
          status: tc.status,
          timestamp: tc.timestamp,
          description: tc.description
        }));
      }

      return msg;
    });

    const userMsgs = messages.filter(m => m.type === 'user');
    const geminiMsgs = messages.filter(m => m.type === 'gemini');
    
    const toolChain = messages
      .flatMap(m => m.toolCalls || [])
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .map(tc => tc.name);
    
    const tokenUsage = session.messages.reduce((acc: any, m: any) => {
      if (m.type === 'gemini' && m.tokens) {
        acc.input += m.tokens.input || 0;
        acc.output += m.tokens.output || 0;
        acc.thoughts += m.tokens.thoughts || 0;
        acc.total += m.tokens.total || 0;
      }
      return acc;
    }, { input: 0, output: 0, thoughts: 0, total: 0 });

    const firstPrompt = userMsgs[0]?.content || "";
    const category = this.coachService.detectCategory(firstPrompt, toolChain);
    const correctionCount = this.coachService.countCorrections(userMsgs, messages);

    // Smart project naming: fallback to file path if name is a hash or missing
    let projectName = session.projectName || session.projectHash || "Unknown";
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
      sessionId: session.sessionId,
      projectName,
      sessionTitle: firstPrompt.substring(0, 50),
      projectHash: session.projectHash,
      modelId: geminiMsgs[geminiMsgs.length - 1]?.model || "unknown",
      category,
      provider: 'gemini',
      startTime: session.startTime,
      lastUpdated: session.lastUpdated,
      expressionQuality: {
        score: this.coachService.calculateQualityScore(correctionCount, firstPrompt),
        ambiguities: this.coachService.detectAmbiguities(firstPrompt),
        suggestion: this.coachService.generateSuggestion(firstPrompt)
      },
      stats: {
        turns: userMsgs.length + geminiMsgs.length,
        userTurns: userMsgs.length,
        geminiTurns: geminiMsgs.length,
        corrections: correctionCount,
        toolChain,
        tokenUsage
      },
      messages
    };
  }
}
