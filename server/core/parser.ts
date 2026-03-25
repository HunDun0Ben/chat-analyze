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
    let session: any;
    try {
      session = JSON.parse(rawData);
    } catch (err) {
      throw new Error(`Invalid JSON format: ${(err as Error).message}`);
    }

    if (!session || typeof session !== 'object') {
      throw new Error('Invalid session data: Not an object');
    }

    // Detect ChatGPT export format
    if (session.mapping && (session.conversation_id || session.id)) {
      return this.analyzeChatGPT(session, filePath);
    }

    // Standard Gemini session format check
    if (!Array.isArray(session.messages)) {
      throw new Error('Not a valid session: Missing "messages" array');
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

  private analyzeChatGPT(session: any, filePath: string): AnalyzedSessionInterface {
    const messages: SessionMessage[] = [];
    let currentNodeId = session.current_node;
    const nodeChain: any[] = [];

    // Reconstruct conversation thread from leaf to root
    while (currentNodeId && session.mapping[currentNodeId]) {
      const node = session.mapping[currentNodeId];
      if (node.message) {
        nodeChain.push(node.message);
      }
      currentNodeId = node.parent;
    }
    nodeChain.reverse();

    const resultMessages: SessionMessage[] = [];
    let currentThoughts: any[] = [];
    let currentToolCalls: any[] = [];
    let pendingAssistantMsg: SessionMessage | null = null;

    for (const m of nodeChain) {
      const role = m.author.role;
      const content = this.extractContent(m.content);
      const timestamp = m.create_time ? new Date(m.create_time * 1000).toISOString() : new Date().toISOString();

      if (role === 'user') {
        // Commit previous assistant message if any
        if (pendingAssistantMsg) {
          resultMessages.push(pendingAssistantMsg);
          pendingAssistantMsg = null;
        }
        
        resultMessages.push({
          id: m.id,
          timestamp,
          type: 'user',
          content,
          model: m.metadata?.model_slug || "chatgpt"
        });
        
        // Reset buffers for next turn
        currentThoughts = [];
        currentToolCalls = [];
      } else if (role === 'assistant') {
        // Ensure pendingAssistantMsg exists for any assistant activity
        if (!pendingAssistantMsg) {
          pendingAssistantMsg = {
            id: m.id,
            timestamp,
            type: 'gemini',
            content: "",
            model: m.metadata?.model_slug || "chatgpt",
            thoughts: currentThoughts,
            toolCalls: currentToolCalls
          };
        }

        // Handle thoughts/reasoning
        if (m.recipient === 'thought') {
          currentThoughts.push({
            subject: 'Thinking',
            description: content,
            timestamp
          });
          pendingAssistantMsg.thoughts = [...currentThoughts];
          continue;
        }

        // Handle tool calls (code interpreter or search)
        if (m.content?.content_type === 'code' || m.recipient === 'browser' || m.recipient === 'python') {
          const toolName = m.recipient === 'browser' ? 'search' : (m.recipient === 'python' ? 'code_interpreter' : 'tool');
          currentToolCalls.push({
            id: m.id,
            name: toolName,
            args: { code: content },
            status: 'pending',
            timestamp
          });
          pendingAssistantMsg.toolCalls = [...currentToolCalls];
          continue;
        }

        // Aggregate normal text content
        if (content.trim()) {
          pendingAssistantMsg.content = (pendingAssistantMsg.content + "\n" + content).trim();
        }
      } else if (role === 'tool') {
        // Link tool result to the last pending tool call
        if (currentToolCalls.length > 0) {
          const lastTool = currentToolCalls[currentToolCalls.length - 1];
          lastTool.result = content;
          lastTool.status = 'success';
          
          if (pendingAssistantMsg) {
            pendingAssistantMsg.toolCalls = [...currentToolCalls];
          }
        }
      } else if (role === 'system' && content.trim()) {
        resultMessages.push({
          id: m.id,
          timestamp,
          type: 'info',
          content,
          model: 'system'
        });
      }
    }

    // Final commit
    if (pendingAssistantMsg) {
      resultMessages.push(pendingAssistantMsg);
    }

    const userMsgs = resultMessages.filter(m => m.type === 'user');
    const geminiMsgs = resultMessages.filter(m => m.type === 'gemini');
    const firstPrompt = userMsgs[0]?.content || "";
    
    // Extract tool chain for category detection
    const toolChain = resultMessages
      .flatMap(m => m.toolCalls || [])
      .map(tc => tc.name);

    const correctionCount = this.countCorrections(userMsgs, resultMessages);

    return {
      sessionId: session.conversation_id || session.id,
      projectName: session.title || "ChatGPT Import",
      projectHash: "chatgpt-import",
      modelId: geminiMsgs[geminiMsgs.length - 1]?.model || "chatgpt",
      category: this.detectCategory(firstPrompt, toolChain),
      startTime: session.create_time ? new Date(session.create_time * 1000).toISOString() : new Date().toISOString(),
      lastUpdated: session.update_time ? new Date(session.update_time * 1000).toISOString() : new Date().toISOString(),
      expressionQuality: {
        score: this.calculateQualityScore(correctionCount, firstPrompt),
        ambiguities: this.detectAmbiguities(firstPrompt),
        suggestion: this.generateSuggestion(firstPrompt)
      },
      stats: {
        turns: resultMessages.length,
        userTurns: userMsgs.length,
        geminiTurns: geminiMsgs.length,
        corrections: correctionCount,
        toolChain,
        tokenUsage: { input: 0, output: 0, thoughts: 0, total: 0 }
      },
      messages: resultMessages
    };
  }

  private extractContent(content: any): string {
    if (!content) return "";
    if (typeof content === 'string') return content;
    
    if (Array.isArray(content)) {
      return content.map(c => this.extractContent(c)).join("\n");
    }

    if (typeof content === 'object') {
      // Handle parts array (common in Gemini and ChatGPT)
      if (Array.isArray(content.parts)) {
        return content.parts.map((p: any) => typeof p === 'string' ? p : this.extractContent(p)).join("\n");
      }
      // Handle text field (common in ChatGPT tool calls/results)
      if (content.text) return content.text;
      // Handle nested values
      if (content.value) return this.extractContent(content.value);
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
