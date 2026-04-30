import * as fs from 'node:fs';
import * as readline from 'node:readline';
import crypto from 'node:crypto';
import {
  AnalyzedSession,
  SessionMessage,
  ToolCall,
} from '../../types/index.js';
import { BaseParser, ParserOptions } from './BaseParser.js';
import { CoachService } from '../services/CoachService.js';

interface RawSessionMetadata {
  sessionId?: string;
  projectHash?: string;
  startTime?: string;
  lastUpdated?: string;
  kind?: string;
}

interface RawUserTurnEvent {
  id: string;
  timestamp: string;
  type: 'user';
  content: Array<{ text: string }>;
}

interface RawGeminiTurnEvent {
  id: string;
  timestamp: string;
  type: 'gemini';
  content: string;
  thoughts?: Array<{ subject: string; description: string }>;
  tokens?: {
    input: number;
    output: number;
    cached: number;
    thoughts: number;
    tool: number;
    total: number;
  };
  model?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    args?: Record<string, unknown>;
    result?: {
      functionResponse: { id: string; name: string; response: unknown };
    };
    status?: 'success' | 'failure' | 'pending';
    timestamp: string;
  }>;
}

interface RawInfoEvent {
  id: string;
  timestamp: string;
  type: 'info';
  content: string;
}

interface RawSetEvent {
  $set: {
    lastUpdated?: string;
    // Potentially other fields can be updated
  };
}

type JsonlRecord =
  | RawSessionMetadata
  | RawUserTurnEvent
  | RawGeminiTurnEvent
  | RawInfoEvent
  | RawSetEvent;

export class GeminiJsonlParser extends BaseParser {
  constructor(coachService: CoachService) {
    super(coachService);
  }

  async analyze(
    sessionData: unknown, // This will be the filePath in this parser
    options: ParserOptions,
  ): Promise<AnalyzedSession> {
    const { filePath } = options;
    const session: Partial<AnalyzedSession> = {
      sessionId: 'unknown',
      projectName: 'Imported', // Default
      sessionTitle: 'Untitled Session', // Default
      projectHash: '',
      modelId: 'unknown',
      category: undefined,
      provider: 'gemini',
      startTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      expressionQuality: {
        score: 0,
        ambiguities: [],
        suggestion: '',
      },
      stats: {
        turns: 0,
        userTurns: 0,
        geminiTurns: 0,
        corrections: 0,
        toolChain: [],
        tokenUsage: { input: 0, output: 0, thoughts: 0, total: 0 },
      },
      messages: [],
    };

    const messages: SessionMessage[] = [];
    let userTurns = 0;
    let geminiTurns = 0;
    const toolChain: string[] = [];
    const tokenUsage = { input: 0, output: 0, thoughts: 0, total: 0 };

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isFirstLine = true;

    for await (const line of rl) {
      if (line.trim().length === 0) continue;

      try {
        const record: JsonlRecord = JSON.parse(line);

        if (isFirstLine) {
          // First line is session metadata
          const meta = record as RawSessionMetadata;
          if (meta.sessionId) session.sessionId = meta.sessionId;
          if (meta.projectHash) session.projectHash = meta.projectHash;
          if (meta.startTime) session.startTime = meta.startTime;
          if (meta.lastUpdated) session.lastUpdated = meta.lastUpdated;
          isFirstLine = false;
          continue; // Process next line
        }

        if ('$set' in record) {
          // Handle $set events
          Object.assign(session, (record as RawSetEvent).$set);
        } else if ('type' in record) {
          const rawMessage = record as
            | RawUserTurnEvent
            | RawGeminiTurnEvent
            | RawInfoEvent;

          const msg: SessionMessage = {
            id: rawMessage.id || crypto.randomBytes(16).toString('hex'),
            timestamp: rawMessage.timestamp,
            type: rawMessage.type,
            content: '',
          };

          if (rawMessage.type === 'user') {
            msg.content =
              rawMessage.content
                .map((part) => (typeof part === 'string' ? part : part.text))
                .join('\\n') || '';
            userTurns++;
          } else if (rawMessage.type === 'gemini') {
            msg.content = rawMessage.content;
            msg.model = rawMessage.model;
            geminiTurns++;

            if (rawMessage.thoughts && rawMessage.thoughts.length > 0) {
              msg.thoughts = rawMessage.thoughts.map((t) => ({
                subject: t.subject,
                description: t.description,
                timestamp: rawMessage.timestamp, // Assuming thought timestamp is message timestamp
              }));
            }

            if (rawMessage.toolCalls && rawMessage.toolCalls.length > 0) {
              msg.toolCalls = rawMessage.toolCalls.map((tc) => {
                const toolCall: ToolCall = {
                  id: tc.id,
                  name: tc.name,
                  args: tc.args || {},
                  status: tc.status || 'pending',
                  timestamp: tc.timestamp,
                };
                if (tc.result && tc.result.functionResponse) {
                  toolCall.result = tc.result.functionResponse.response;
                  toolCall.status = 'success'; // Assume success if result is present
                }
                toolChain.push(tc.name);
                return toolCall;
              });
            }

            if (rawMessage.tokens) {
              tokenUsage.input += rawMessage.tokens.input || 0;
              tokenUsage.output += rawMessage.tokens.output || 0;
              tokenUsage.thoughts += rawMessage.tokens.thoughts || 0;
              tokenUsage.total += rawMessage.tokens.total || 0;
            }
          } else if (rawMessage.type === 'info') {
            msg.content = rawMessage.content;
          }
          messages.push(msg);
        }
      } catch (e) {
        console.error(`[GeminiJsonlParser] Error parsing line: ${line}`, e);
        // Decide whether to throw or continue. For robustness, we'll continue for now.
      }
    }

    rl.close();
    fileStream.close();

    session.messages = messages;
    session.stats!.turns = messages.length; // messages.length includes all types, not just user/gemini
    session.stats!.userTurns = userTurns;
    session.stats!.geminiTurns = geminiTurns;
    session.stats!.toolChain = toolChain;
    session.stats!.tokenUsage = tokenUsage;

    const geminiMsgs = messages.filter((m) => m.type === 'gemini');
    if (geminiMsgs.length > 0) {
      session.modelId = geminiMsgs[geminiMsgs.length - 1].model || 'unknown';
    }

    // Derive sessionTitle
    if (session.messages.length > 0) {
      const firstUserMessage = session.messages.find((m) => m.type === 'user');
      session.sessionTitle =
        firstUserMessage?.content?.substring(0, 50) || 'Untitled Session';
    } else {
      session.sessionTitle = 'Untitled Session';
    }

    // CoachService analysis
    const firstPrompt = messages.find((m) => m.type === 'user')?.content || '';
    const correctionCount = this.coachService.countCorrections(
      messages.filter((m) => m.type === 'user'),
      messages,
    );
    session.expressionQuality = {
      score: this.coachService.calculateQualityScore(
        correctionCount,
        firstPrompt,
      ),
      ambiguities: this.coachService.detectAmbiguities(firstPrompt),
      suggestion: this.coachService.generateSuggestion(firstPrompt),
    };
    session.category = this.coachService.detectCategory(firstPrompt, toolChain);

    return session as AnalyzedSession;
  }
}
