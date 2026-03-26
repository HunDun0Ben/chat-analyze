export interface SidebarSession {
  sessionId: string;
  sessionTitle?: string;
  projectName: string;
  provider: 'gemini' | 'chatgpt';
  startTime: string;
  isCheckpoint?: boolean;
  expressionQuality: { score: number };
  firstMessage?: string;
}

export interface SessionSummary {
  sessionId: string;
  projectName: string;
  category: string;
  startTime: string;
  score: number;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'success' | 'failure' | 'pending';
  timestamp: string;
}

export interface MessageThought {
  subject: string;
  description: string;
}

export interface SessionMessage {
  id: string;
  type: 'user' | 'gemini' | 'info';
  content: string;
  thoughts?: MessageThought[];
  toolCalls?: ToolCall[];
  timestamp: string;
}

export interface AnalyzedSession {
  sessionId: string;
  projectName: string;
  sessionTitle?: string;
  isCheckpoint?: boolean; // 新增：标识是否为 Checkpoint 文件
  projectHash: string;
  modelId: string;
  category: string;
  provider: 'gemini' | 'chatgpt';

  startTime: string;
  lastUpdated: string;
  expressionQuality: {
    score: number;
    ambiguities: string[];
    suggestion: string;
  };
  stats: {
    turns: number;
    corrections: number;
    toolChain: string[];
    tokenUsage: {
      input: number;
      output: number;
      total: number;
    };
  };
  messages: SessionMessage[];
}

export interface StatsTimeline {
  date: string;
  avgScore: number;
}

export interface ModelStat {
  modelId: string;
  sessionCount: number;
  avgScore: number;
  avgTokens: number;
  avgTurns: number;
}
