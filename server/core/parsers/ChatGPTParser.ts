import {
  AnalyzedSession,
  SessionMessage,
  ToolCall,
} from '../../types/index.js';
import { BaseParser } from './BaseParser.js';
import { ParserOutput } from '../parsing/result.js';
import { SessionSource } from '../parsing/source.js';
import { extractContent } from '../parsing/shared/content.js';
import { isRecord } from '../parsing/shared/guards.js';
import { resolveSessionId } from '../parsing/shared/ids.js';
import {
  chatGPTExportSchema,
  describeZodError,
  type ChatGPTMessage,
} from './schemas.js';

export class ChatGPTParser extends BaseParser {
  async parse(source: SessionSource): Promise<ParserOutput> {
    const { filePath, fileName } = source;
    const parsed = chatGPTExportSchema.safeParse(await source.readJson());

    if (!parsed.success) {
      throw new Error(
        `Not a valid ChatGPT export: ${describeZodError(parsed.error)}`,
      );
    }

    const s = parsed.data;
    const fallbackTimestamp = new Date(source.stat.mtimeMs).toISOString();
    const mapping = s.mapping;
    const nodeChain: ChatGPTMessage[] = [];

    // Reconstruct conversation thread from leaf to root
    let pointer: string | undefined = s.current_node;
    while (pointer && mapping[pointer]) {
      const node = mapping[pointer];
      if (node.message) nodeChain.push(node.message);
      pointer = node.parent ?? undefined;
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
      const role = m.author?.role;
      const content = extractContent(m.content);
      const metadata = m.metadata ?? {};
      const modelSlug =
        typeof metadata.model_slug === 'string'
          ? metadata.model_slug
          : undefined;
      const timestamp =
        m.create_time !== null && m.create_time !== undefined
          ? new Date(m.create_time * 1000).toISOString()
          : fallbackTimestamp;

      if (role === 'user') {
        if (pendingAssistantMsg) {
          resultMessages.push(pendingAssistantMsg);
          pendingAssistantMsg = null;
        }

        resultMessages.push({
          id: m.id ?? '',
          timestamp,
          type: 'user',
          content,
          model: modelSlug || 'chatgpt',
        });

        currentThoughts = [];
        currentToolCalls = [];
      } else if (role === 'assistant') {
        if (!pendingAssistantMsg) {
          pendingAssistantMsg = {
            id: m.id ?? '',
            timestamp,
            type: 'gemini', // Using 'gemini' type for assistant consistency in UI
            content: '',
            model: modelSlug || 'chatgpt',
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

        const mContent = isRecord(m.content) ? m.content : {};
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
            id: m.id ?? '',
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
          id: m.id ?? '',
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
      sessionId: resolveSessionId(s, source.filePath, source.index),
      projectName: 'ChatGPT Import',
      projectNameIsPlaceholder: true,
      sessionTitle: fileName || s.title || 'ChatGPT Chat',
      projectHash: 'chatgpt-import',
      modelId: geminiMsgs[geminiMsgs.length - 1]?.model || 'chatgpt',
      category: this.coachService.detectCategory(firstPrompt, toolChain),
      provider: 'chatgpt',
      startTime:
        s.create_time !== null && s.create_time !== undefined
          ? new Date(s.create_time * 1000).toISOString()
          : fallbackTimestamp,
      lastUpdated:
        s.update_time !== null && s.update_time !== undefined
          ? new Date(s.update_time * 1000).toISOString()
          : fallbackTimestamp,
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
      filePath,
    };

    if (s.title && fileName && s.title !== fileName) {
      result.sessionTitle = `${fileName} (${s.title})`;
    }

    return { sessions: [result], warnings: [] };
  }
}
