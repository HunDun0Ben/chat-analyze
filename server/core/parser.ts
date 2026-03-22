/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Session Parser Implementation
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { 
  AnalyzedSession, 
  SessionMessage, 
  TaskCategory, 
  AnalyzedSession as AnalyzedSessionInterface
} from '../types/index.js';

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
    
    // 提取全局工具链轨迹 (按时间戳严格排序)
    const toolChain = messages
      .flatMap(m => m.toolCalls || [])
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .map(tc => tc.name);
    
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
    const correctionCount = this.countCorrections(userMsgs, messages);

    // 智能提取项目名称：优先使用 JSON 里的，如果是哈希则从路径提取
    let projectName = session.projectName || session.projectHash || "Unknown";
    if (/^[a-f0-9]{64}$/.test(projectName)) {
      const parts = filePath.split(path.sep);
      const chatsIdx = parts.indexOf('chats');
      if (chatsIdx > 0) {
        projectName = parts[chatsIdx - 1];
      } else if (parts.length >= 2) {
        projectName = parts[parts.length - 2];
      }
    }

    return {
      sessionId: session.sessionId,
      projectName,
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
    // 优先级排序：Coding -> Ops -> Research -> Investigate -> Arch -> Learning -> General
    if (tools.some(t => ['replace', 'write_file', 'apply_diff'].includes(t))) return 'Coding';
    if (tools.some(t => ['run_shell_command', 'gh'].includes(t))) return 'Ops';
    if (tools.some(t => ['web_fetch', 'google_web_search'].includes(t))) return 'Research';
    if (tools.some(t => ['grep_search', 'glob', 'list_directory'].includes(t))) return 'Investigate';
    
    if (/架构|设计|模式|architecture|design|pattern/.test(prompt.toLowerCase())) return 'Arch';
    if (/解释|如何|原理|学习|explain|how|why|learn/.test(prompt.toLowerCase())) return 'Learning';
    
    return 'General';
  }

  private countCorrections(userMsgs: SessionMessage[], allMsgs: SessionMessage[]): number {
    const correctionPatterns = [/不对/, /错误/, /重新/, /理解错/, /不是这个/, /wrong/, /incorrect/, /fix/, /报错/];
    const userCount = userMsgs.filter(m => 
      correctionPatterns.some(p => p.test(m.content.toLowerCase()))
    ).length;

    // 工具失败 (隐性纠错)
    const toolFailures = allMsgs.flatMap(m => m.toolCalls || [])
      .filter(tc => tc.status === 'error').length;

    return userCount + toolFailures;
  }

  private calculateQualityScore(corrections: number, prompt: string): number {
    if (!prompt) return 100;
    
    let score = 100;
    
    // 1. 纠错扣分 (权重最高)
    score -= (corrections * 15);
    
    // 2. 长度扣分
    if (prompt.length < 10) score -= 15;
    else if (prompt.length < 30) score -= 5;
    
    // 3. 模糊词扣分
    const ambiguities = this.detectAmbiguities(prompt);
    score -= (ambiguities.length * 10);
    
    // 4. 上下文缺失扣分 (如没有文件路径、代码块或引用)
    const hasContext = /[\/\.\w]+\.\w+|`{1,3}|@\w+/.test(prompt);
    if (!hasContext && prompt.length > 20) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private detectAmbiguities(prompt: string): string[] {
    const ambiguities: string[] = [];
    if (!prompt) return ambiguities;

    const dictionary = [
      { pattern: /这个|那个|这些|那些|这儿|那儿/, label: "过度依赖上下文代词" },
      { pattern: /所有的|全部的|整改|整体/, label: "操作范围描述模糊" },
      { pattern: /帮我|帮下|给个|写个/, label: "指令意图过于口语化" },
      { pattern: /快点|立即|马上|给我/, label: "缺乏逻辑引导的紧迫感" },
      { pattern: /类似|差不多|这种/, label: "缺乏具体对比基准" }
    ];

    dictionary.forEach(rule => {
      if (rule.pattern.test(prompt)) {
        ambiguities.push(rule.label);
      }
    });

    if (prompt.length < 15) ambiguities.push("指令信息量过低");

    return [...new Set(ambiguities)];
  }

  private generateSuggestion(prompt: string): string {
    if (!prompt) return "等待您的第一条指令以开始分析。";
    
    const ambiguities = this.detectAmbiguities(prompt);
    const category = this.detectCategory(prompt, []); // 传入空工具链进行预判

    if (ambiguities.length > 0) {
      if (ambiguities.includes("过度依赖上下文代词")) {
        return "建议使用具体的类名、方法名或文件名替换 '这个/那个'，以减少模型理解偏差。";
      }
      if (prompt.length < 15) {
        return "指令过短。尝试采用 [背景] + [任务目标] + [约束条件] 的三段式结构。";
      }
    }

    if (category === 'Coding') {
      return "建议在 Prompt 中明确预期的输入输出，并要求模型在操作前先进行 'Thought' 思考过程。";
    }

    if (category === 'Learning') {
      return "针对学习类任务，可以要求模型 '由浅入深' 或 '提供对比示例'。";
    }

    return "当前提问质量良好。您可以尝试加入 '角色设定'（如：资深架构师）来获取更具深度的回应。";
  }
}
