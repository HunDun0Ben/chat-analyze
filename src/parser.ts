/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Session Parser Implementation
 */

import fs from 'node:fs/promises';
import { 
  AnalyzedSession, 
  SessionMessage, 
  TaskCategory, 
  AnalyzedSession as AnalyzedSessionInterface
} from './types.js';

export class SessionParser {
  async analyze(filePath: string): Promise<AnalyzedSessionInterface> {
    const rawData = await fs.readFile(filePath, 'utf-8');
    const session = JSON.parse(rawData);

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
    const toolChain = geminiMsgs.flatMap(m => m.toolCalls?.map(tc => tc.name) || []);
    
    // 聚合 Token 消耗 (优化为 O(N))
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
    const category = this.detectCategory(firstPrompt, toolChain);
    const correctionCount = this.countCorrections(userMsgs);

    return {
      sessionId: session.sessionId,
      projectName: session.projectName || session.projectHash || "Unknown",
      projectHash: session.projectHash,
      modelId: geminiMsgs[geminiMsgs.length - 1]?.model || "unknown",
      category,
      startTime: session.startTime,
      lastUpdated: session.lastUpdated,
      expressionQuality: {
        score: this.calculateQualityScore(correctionCount, firstPrompt),
        ambiguities: this.detectAmbiguities(firstPrompt),
        suggestion: this.generateSuggestion(firstPrompt)
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

  private extractContent(content: any): string {
    if (!content) return "";
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map(c => c.text || "").join("");
    }
    if (typeof content === 'object' && (content as any).text) {
      return (content as any).text;
    }
    return "";
  }

  private detectCategory(prompt: string, tools: string[]): TaskCategory {
    if (tools.some(t => ['replace', 'write_file'].includes(t))) return 'Coding';
    if (/解释|如何|原理|学习/.test(prompt)) return 'Learning';
    if (tools.some(t => ['run_shell_command'].includes(t))) return 'Ops';
    if (/架构|设计|模式/.test(prompt)) return 'Arch';
    return 'General';
  }

  private countCorrections(userMsgs: SessionMessage[]): number {
    const correctionPatterns = [/不对/, /错误/, /重新/, /理解错/, /不是这个/];
    return userMsgs.filter(m => 
      correctionPatterns.some(p => p.test(m.content))
    ).length;
  }

  private calculateQualityScore(corrections: number, prompt: string): number {
    if (!prompt && corrections === 0) return 100;
    let score = 100;
    score -= corrections * 15;
    if (prompt && prompt.length < 15) score -= 10;
    return Math.max(0, score);
  }

  private detectAmbiguities(prompt: string): string[] {
    const ambiguities: string[] = [];
    if (!prompt) return ambiguities;
    if (prompt.includes('这个') || prompt.includes('那个')) ambiguities.push("使用模糊代词");
    if (prompt.length < 10) ambiguities.push("指令描述过短");
    return ambiguities;
  }

  private generateSuggestion(prompt: string): string {
    if (!prompt) return "等待您的第一条指令以开始分析。";
    if (prompt.length < 15) return "建议补充更多上下文，例如具体的文件路径或预期的代码行为。";
    if (this.detectAmbiguities(prompt).length > 0) return "尝试替换 '这个'、'那个' 为具体的类名、函数名或文件名。";
    return "保持良好，可尝试在 Prompt 中加入 '作为一名资深架构师' 等角色约束。";
  }
}
