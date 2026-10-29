import type { MessageRole } from './session.js';

export interface MessageCounts {
  user: number;
  assistant: number;
  system: number;
  info: number;
  /** Every message, including `system` / `info`. */
  total: number;
  /** `user + assistant`; the single definition of `stats.turns`. */
  turns: number;
}

/**
 * Counts a transcript by role.
 *
 * `turns` deliberately excludes `system` / `info`: a tool notice or a system
 * prompt is not a conversational turn. Every parser uses this helper so a
 * transcript scores the same no matter which provider exported it.
 */
export function countMessages(
  messages: readonly { type: MessageRole }[],
): MessageCounts {
  const counts: MessageCounts = {
    user: 0,
    assistant: 0,
    system: 0,
    info: 0,
    total: messages.length,
    turns: 0,
  };

  for (const message of messages) {
    switch (message.type) {
      case 'user':
        counts.user++;
        break;
      case 'assistant':
        counts.assistant++;
        break;
      case 'system':
        counts.system++;
        break;
      case 'info':
        counts.info++;
        break;
    }
  }

  counts.turns = counts.user + counts.assistant;
  return counts;
}

/** Turn-related fields of `SessionStats`, derived from a transcript. */
export interface TurnStats {
  turns: number;
  totalMessages: number;
  userTurns: number;
  assistantTurns: number;
}

export function turnStats(
  messages: readonly { type: MessageRole }[],
): TurnStats {
  const counts = countMessages(messages);
  return {
    turns: counts.turns,
    totalMessages: counts.total,
    userTurns: counts.user,
    assistantTurns: counts.assistant,
  };
}
