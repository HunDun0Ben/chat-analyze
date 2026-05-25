import {
  AnalyzedSession,
  SessionMessage,
  ToolCall,
} from '../../types/index.js';
import { BaseParser, ParserOptions } from './BaseParser.js';

export class ChatGPTParser extends BaseParser {
  async analyze(
    session: unknown,
    options: ParserOptions,
  ): Promise<AnalyzedSession> {
    const s = session as Record<string, unknown>;
    const currentNodeId = s.current_node as string;
    const nodeChain: Record<string, unknown>[] = [];

    // Reconstruct conversation thread from leaf to root
    let pointer: string | undefined = currentNodeId;
    const mapping = (s.mapping || {}) as Record<
      string,
      Record<string, unknown>
    >;
    while (pointer && mapping[pointer]) {
      const node = mapping[pointer];
      if (node.message) {
        nodeChain.push(node.message as Record<string, unknown>);
      }
      pointer = node.parent as string | undefined;
    }
    nodeChain.reverse();

    const resultMessages: SessionMessage[] = [];
    let currentThoughts: {
      subject: string;
      description: string;
      timestamp: string;
    }[] = [];
    let currentToolCalls: ToolCall[] = [];
    let pendingAssistantMsg: SessionMessage | null = null;

    for (const m of nodeChain) {
      const author = (m.author || {}) as Record<string, string>;
      const role = author.role;
      const content = this.extractContent(m.content);
      const mMetadata = (m.metadata || {}) as Record<string, unknown>;
      const timestamp = m.create_time
        ? new Date((m.create_time as number) * 1000).toISOString()
        : new Date().toISOString();

      if (role === 'user') {
        if (pendingAssistantMsg) {
          resultMessages.push(pendingAssistantMsg);
          pendingAssistantMsg = null;
        }

        resultMessages.push({
          id: m.id as string,
          timestamp,
          type: 'user',
          content,
          model: (mMetadata.model_slug as string) || 'chatgpt',
        });

        currentThoughts = [];
        currentToolCalls = [];
      } else if (role === 'assistant') {
        if (!pendingAssistantMsg) {
          pendingAssistantMsg = {
            id: m.id as string,
            timestamp,
            type: 'gemini', // Using 'gemini' type for assistant consistency in UI
            content: '',
            model: (mMetadata.model_slug as string) || 'chatgpt',
            thoughts: currentThoughts,
            toolCalls: currentToolCalls,
          };
        }

        if (m.recipient === 'thought') {
          currentThoughts.push({
            subject: 'Thinking',
            description: content,
            timestamp,
          });
          if (pendingAssistantMsg) {
            pendingAssistantMsg.thoughts = [...currentThoughts];
          }
          continue;
        }

        const mContent = (m.content || {}) as Record<string, unknown>;
        if (
          mContent.content_type === 'code' ||
          m.recipient === 'browser' ||
          m.recipient === 'python'
        ) {
          const toolName =
            m.recipient === 'browser'
              ? 'search'
              : m.recipient === 'python'
                ? 'code_interpreter'
                : 'tool';
          currentToolCalls.push({
            id: m.id as string,
            name: toolName,
            args: { code: content },
            status: 'success',
            timestamp,
          });
          if (pendingAssistantMsg) {
            pendingAssistantMsg.toolCalls = [...currentToolCalls];
          }
          continue;
        }

        if (content.trim() && pendingAssistantMsg) {
          pendingAssistantMsg.content = (
            pendingAssistantMsg.content +
            '\n' +
            content
          ).trim();
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
          id: m.id as string,
          timestamp,
          type: 'info',
          content,
          model: 'system',
        });
      }
    }

    if (pendingAssistantMsg) {
      resultMessages.push(pendingAssistantMsg);
    }

    const userMsgs = resultMessages.filter((m) => m.type === 'user');
    const geminiMsgs = resultMessages.filter((m) => m.type === 'gemini');
    const firstPrompt = userMsgs[0]?.content || '';

    const toolChain = resultMessages
      .flatMap((m) => m.toolCalls || [])
      .map((tc) => tc.name);

    const correctionCount = this.coachService.countCorrections(
      userMsgs,
      resultMessages,
    );

    const result: AnalyzedSession = {
      sessionId: (s.conversation_id as string) || (s.id as string),
      projectName: 'ChatGPT Import',
      sessionTitle: options.fileName || (s.title as string) || 'ChatGPT Chat',
      projectHash: 'chatgpt-import',
      modelId: geminiMsgs[geminiMsgs.length - 1]?.model || 'chatgpt',
      category: this.coachService.detectCategory(firstPrompt, toolChain),
      provider: 'chatgpt',
      startTime: s.create_time
        ? new Date((s.create_time as number) * 1000).toISOString()
        : new Date().toISOString(),
      lastUpdated: s.update_time
        ? new Date((s.update_time as number) * 1000).toISOString()
        : new Date().toISOString(),
      expressionQuality: {
        score: this.coachService.calculateQualityScore(
          correctionCount,
          firstPrompt,
        ),
        ambiguities: this.coachService.detectAmbiguities(firstPrompt),
        suggestion: this.coachService.generateSuggestion(firstPrompt),
      },
      stats: {
        turns: resultMessages.length,
        userTurns: userMsgs.length,
        geminiTurns: geminiMsgs.length,
        corrections: correctionCount,
        toolChain,
        tokenUsage: { input: 0, output: 0, thoughts: 0, total: 0 },
      },
      messages: resultMessages,
      filePath: options.filePath,
    };

    if (s.title && options.fileName && s.title !== options.fileName) {
      result.sessionTitle = `${options.fileName} (${s.title})`;
    }

    return result;
  }
}
