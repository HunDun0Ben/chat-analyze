/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Core Data Types
 */

export type TaskCategory = 'Coding' | 'Learning' | 'Ops' | 'Arch' | 'Investigate' | 'Research' | 'General';

export interface AnalyzedSession {
  sessionId: string;
  projectName: string;
  sessionTitle?: string;  // 新增：用于在侧边栏显示的标题
  projectHash: string;
  modelId: string;       // Last used model
  category: TaskCategory;
  provider: 'gemini' | 'chatgpt';
  
  startTime: string;     // ISO date
  lastUpdated: string;   // ISO date

  // Coach Module
  expressionQuality: {
    score: number;       // 0-100
    ambiguities: string[];
    suggestion: string;
  };

  // Efficiency stats
  stats: {
    turns: number;        // total messages excluding 'info'
    userTurns: number;
    geminiTurns: number;
    corrections: number;  // Detected retry/correction behavior
    toolChain: string[];  // Sequence of tool names
    tokenUsage: {
      input: number;
      output: number;
      thoughts: number;
      total: number;
    };
  };

  messages: SessionMessage[];
}

export interface SessionMessage {
  id: string;
  timestamp: string;
  type: 'user' | 'gemini' | 'info';
  content: string;
  displayContent?: string;
  thoughts?: MessageThought[];
  toolCalls?: ToolCall[];
  model?: string;
}

export interface MessageThought {
  subject: string;
  description: string;
  timestamp: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: any;
  status: 'success' | 'failure' | 'pending';
  timestamp: string;
  description?: string;
}
