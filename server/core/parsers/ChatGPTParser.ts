/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - ChatGPT Session Parser
 */

import { 
  AnalyzedSession, 
  SessionMessage 
} from '../../types/index.js';
import { BaseParser, ParserOptions } from './BaseParser.js';

export class ChatGPTParser extends BaseParser {
  async analyze(session: any, options: ParserOptions): Promise<AnalyzedSession> {
    const currentNodeId = session.current_node;
    const nodeChain: any[] = [];

    // Reconstruct conversation thread from leaf to root
    let pointer = currentNodeId;
    while (pointer && session.mapping[pointer]) {
      const node = session.mapping[pointer];
      if (node.message) {
        nodeChain.push(node.message);
      }
      pointer = node.parent;
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
        
        currentThoughts = [];
        currentToolCalls = [];
      } else if (role === 'assistant') {
        if (!pendingAssistantMsg) {
          pendingAssistantMsg = {
            id: m.id,
            timestamp,
            type: 'gemini', // Using 'gemini' type for assistant consistency in UI
            content: "",
            model: m.metadata?.model_slug || "chatgpt",
            thoughts: currentThoughts,
            toolCalls: currentToolCalls
          };
        }

        if (m.recipient === 'thought') {
          currentThoughts.push({
            subject: 'Thinking',
            description: content,
            timestamp
          });
          pendingAssistantMsg.thoughts = [...currentThoughts];
          continue;
        }

        if (m.content?.content_type === 'code' || m.recipient === 'browser' || m.recipient === 'python') {
          const toolName = m.recipient === 'browser' ? 'search' : (m.recipient === 'python' ? 'code_interpreter' : 'tool');
          currentToolCalls.push({
            id: m.id,
            name: toolName,
            args: { code: content },
            status: 'success',
            timestamp
          });
          pendingAssistantMsg.toolCalls = [...currentToolCalls];
          continue;
        }

        if (content.trim()) {
          pendingAssistantMsg.content = (pendingAssistantMsg.content + "\n" + content).trim();
        }
      } else if (role === 'tool') {
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

    if (pendingAssistantMsg) {
      resultMessages.push(pendingAssistantMsg);
    }

    const userMsgs = resultMessages.filter(m => m.type === 'user');
    const geminiMsgs = resultMessages.filter(m => m.type === 'gemini');
    const firstPrompt = userMsgs[0]?.content || "";
    
    const toolChain = resultMessages
      .flatMap(m => m.toolCalls || [])
      .map(tc => tc.name);

    const correctionCount = this.coachService.countCorrections(userMsgs, resultMessages);

    const result: AnalyzedSession = {
      sessionId: session.conversation_id || session.id,
      projectName: "ChatGPT Import",
      sessionTitle: options.fileName || session.title || "ChatGPT Chat",
      projectHash: "chatgpt-import",
      modelId: geminiMsgs[geminiMsgs.length - 1]?.model || "chatgpt",
      category: this.coachService.detectCategory(firstPrompt, toolChain),
      provider: 'chatgpt',
      startTime: session.create_time ? new Date(session.create_time * 1000).toISOString() : new Date().toISOString(),
      lastUpdated: session.update_time ? new Date(session.update_time * 1000).toISOString() : new Date().toISOString(),
      expressionQuality: {
        score: this.coachService.calculateQualityScore(correctionCount, firstPrompt),
        ambiguities: this.coachService.detectAmbiguities(firstPrompt),
        suggestion: this.coachService.generateSuggestion(firstPrompt)
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

    // If there's a title in the JSON and it's different from the filename, 
    // maybe append it to make it more descriptive when multiple sessions exist in one file
    if (session.title && options.fileName && session.title !== options.fileName) {
       result.sessionTitle = `${options.fileName} (${session.title})`;
    }

    return result;
  }
}
