import { CoachService } from '../services/CoachService.js';
import { BaseParser } from '../parsers/BaseParser.js';
import { ChatGPTParser } from '../parsers/ChatGPTParser.js';
import { GeminiCheckpointParser } from '../parsers/GeminiCheckpointParser.js';
import { GeminiParser } from '../parsers/GeminiParser.js';
import { isRecord } from './shared/guards.js';

/**
 * Format registry. Adding a provider means adding one entry here plus its
 * parser class; `SessionAnalyzer` never needs to change.
 *
 * Order matters: the first definition whose `canParse` matches wins.
 */
export interface ParserRegistration {
  format: string;
  /** Probes the raw payload. Presence checks (not strict validation) keep
   * format-specific errors inside the parser, where they can name the field. */
  canParse(payload: unknown): boolean;
  create(coachService: CoachService): BaseParser;
}

export const PARSER_REGISTRATIONS: ParserRegistration[] = [
  {
    format: 'chatgpt-export',
    canParse: (payload) =>
      isRecord(payload) &&
      payload.mapping !== undefined &&
      (payload.conversation_id !== undefined || payload.id !== undefined),
    create: (coachService) => new ChatGPTParser(coachService),
  },
  {
    format: 'gemini-checkpoint',
    canParse: (payload) => isRecord(payload) && payload.history !== undefined,
    create: (coachService) => new GeminiCheckpointParser(coachService),
  },
  {
    format: 'gemini-session',
    canParse: (payload) => isRecord(payload) && payload.messages !== undefined,
    create: (coachService) => new GeminiParser(coachService),
  },
];
