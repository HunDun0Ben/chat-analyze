/**
 * Domain types shared by the server and the dashboard.
 *
 * This is the single definition of the persisted session contract: parsers
 * produce it, the storage layer persists it and the UI renders it. Do not
 * redeclare any of these shapes in `server/` or `ui/`.
 */

export const PROVIDERS = ['gemini', 'chatgpt'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const TASK_CATEGORIES = [
  'Coding',
  'Learning',
  'Ops',
  'Arch',
  'Investigate',
  'Research',
  'General',
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/**
 * Message roles are provider-independent. `gemini` used to double as the
 * assistant role, which made ChatGPT transcripts semantically wrong.
 */
export const MESSAGE_ROLES = ['user', 'assistant', 'system', 'info'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export interface MessageThought {
  subject: string;
  description: string;
  timestamp: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'success' | 'failure' | 'pending';
  timestamp: string;
  description?: string;
}

export interface SessionMessage {
  id: string;
  timestamp: string;
  type: MessageRole;
  content: string;
  /** Markdown the UI should render instead of `content` when present. */
  displayContent?: string;
  thoughts?: MessageThought[];
  toolCalls?: ToolCall[];
  model?: string;
}

export interface ExpressionQuality {
  /** 0-100. Empty sessions are stored but must not be averaged. */
  score: number;
  /** false when the session has no user turn; excluded from every average. */
  scoreable?: boolean;
  ambiguities: string[];
  suggestion: string;
}

export interface SessionStats {
  /** `userTurns + assistantTurns`. `system` / `info` messages never count. */
  turns: number;
  /** Every message in the transcript, including `system` / `info`. */
  totalMessages: number;
  userTurns: number;
  assistantTurns: number;
  /** @deprecated Use `assistantTurns`. Kept for one release so cached payloads stay readable. */
  geminiTurns?: number;
  corrections: number;
  toolChain: string[];
  tokenUsage: {
    input: number;
    output: number;
    thoughts: number;
    total: number;
  };
}

export interface AnalyzedSession {
  sessionId: string;
  projectName: string;
  sessionTitle?: string;
  isCheckpoint?: boolean;
  /** Set by parsers when the name is not derived from the payload; the
   * manager replaces it with the path-based name. */
  projectNameIsPlaceholder?: boolean;
  projectHash: string;
  /** Last model used in the conversation. */
  modelId: string;
  category: TaskCategory;
  provider: Provider;
  startTime: string;
  lastUpdated: string;
  expressionQuality: ExpressionQuality;
  stats: SessionStats;
  messages: SessionMessage[];
  filePath?: string;
}

export interface UserQuestionsSession {
  sessionId: string;
  projectName: string;
  sessionTitle?: string;
  startTime: string;
  questions: string[];
  filePath?: string;
}
