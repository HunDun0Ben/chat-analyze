/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Gemini API Checkpoint Parser
 */

import crypto from 'node:crypto';
import { 
  AnalyzedSession, 
  SessionMessage,
  ToolCall
} from '../../types/index.js';
import { BaseParser, ParserOptions } from './BaseParser.js';

interface GeminiPart {
  text?: string;
  thought?: boolean;
  functionCall?: {
    id?: string;
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    id: string;
    name: string;
    response: unknown;
  };
}

interface GeminiHistoryItem {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/**
 * GeminiCheckpointParser
 * Handles the native Gemini API history format (with 'history' and 'parts').
 */
export class GeminiCheckpointParser extends BaseParser {
  async analyze(session: unknown, options: ParserOptions): Promise<AnalyzedSession> {
    const { filePath, fileName } = options;
    const s = session as { history: GeminiHistoryItem[] };

    if (!s || !Array.isArray(s.history)) {
      throw new Error('Not a valid Gemini checkpoint: Missing "history" array');
    }

    const messages: SessionMessage[] = s.history.map((h, index: number) => {
      const type = h.role === 'model' ? 'gemini' : 'user';
      const timestamp = new Date().toISOString(); // Fallback timestamp

      const msg: SessionMessage = {
        id: `msg-${index}`,
        timestamp,
        type,
        content: ""
      };

      if (Array.isArray(h.parts)) {
        const texts: string[] = [];
        const toolCalls: ToolCall[] = [];

        for (const part of h.parts as GeminiPart[]) {
          if (part.text) {
            if (part.thought === true) {
              if (!msg.thoughts) msg.thoughts = [];
              msg.thoughts.push({
                subject: "Thought Process",
                description: part.text,
                timestamp
              });
            } else {
              texts.push(part.text);
            }
          }

          if (part.functionCall) {
            toolCalls.push({
              id: part.functionCall.id || `call-${index}`,
              name: part.functionCall.name,
              args: part.functionCall.args || {},
              status: 'pending',
              timestamp
            });
          }

          if (part.functionResponse) {
            toolCalls.push({
              id: part.functionResponse.id,
              name: part.functionResponse.name,
              args: {}, // Response doesn't have args
              result: part.functionResponse.response,
              status: 'success',
              timestamp
            });
          }
        }
        
        msg.content = texts.join('\n').trim();
        if (toolCalls.length > 0) msg.toolCalls = toolCalls;
      }

      return msg;
    });

    const userMsgs = messages.filter(m => m.type === 'user');
    const geminiMsgs = messages.filter(m => m.type === 'gemini');
    
    const toolChain = messages
      .flatMap(m => m.toolCalls || [])
      .map(tc => tc.name);

    const firstPrompt = userMsgs.find(m => m.content)?.content || "";
    const category = this.coachService.detectCategory(firstPrompt, toolChain);
    const correctionCount = this.coachService.countCorrections(userMsgs, messages);

    const projectName = this.extractProjectName(fileName || "Unknown");
    const sessionId = this.generateSessionId(filePath);

    // 优先使用完整的文件名（已解码）作为 sessionTitle
    let sessionTitle = (fileName || "checkpoint").replace(/^checkpoint-/, '').replace(/\.json$/, '');
    try {
      sessionTitle = decodeURIComponent(sessionTitle).replace(/^["']/, '').replace(/["']$/, '');
    } catch {
      // 如果解码失败，回退到首条消息或原始文件名
      sessionTitle = firstPrompt.substring(0, 50) || (fileName || "checkpoint");
    }

    return {
      sessionId,
      projectName,
      sessionTitle,
      isCheckpoint: true,
      projectHash: "", // Not available in checkpoints
      modelId: "gemini-pro", // Fallback for checkpoints
      category,
      provider: 'gemini',
      startTime: messages[0]?.timestamp || new Date().toISOString(),
      lastUpdated: messages[messages.length - 1]?.timestamp || new Date().toISOString(),
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
        tokenUsage: { input: 0, output: 0, thoughts: 0, total: 0 } // Checkpoints don't usually include token info
      },
      messages
    };
  }

  /**
   * Smart project name extraction from filenames like:
   * checkpoint-%22redis%20base%20dir%22.json
   */
  private extractProjectName(fileName: string): string {
    let name = fileName;
    try {
      // 1. URL 解码 (处理 %22, %20 等)
      name = decodeURIComponent(fileName);
      
      // 有时可能存在双重编码，再次检查
      if (name.includes('%')) {
        name = decodeURIComponent(name);
      }
    } catch {
      // 解码失败则保留原样
    }

    // 2. 移除 "checkpoint-" 前缀
    name = name.replace(/^checkpoint-/, '');

    // 3. 移除首尾的引号 (JSON 序列化文件名中常见)
    name = name.replace(/^["']/, '').replace(/["']$/, '');

    // 4. 提取第一个有意义的词作为项目名
    // 例如 "redis base dir" -> "redis"
    // 如果是单个词则保留
    const parts = name.split(/[\s_-]/).filter(p => p.length > 0);
    
    if (parts.length > 0) {
      const firstPart = parts[0];
      // 如果第一个词太短且后面还有词，尝试合并（例如 "my app"）
      if (firstPart.length <= 2 && parts.length > 1) {
        return `${parts[0]}-${parts[1]}`;
      }
      return firstPart;
    }

    return name || "Imported";
  }

  private generateSessionId(filePath: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(filePath);
    return hash.digest('hex').substring(0, 32);
  }
}
