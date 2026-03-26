


import { AnalyzedSession } from '../../types/index.js';
import { CoachService } from '../services/CoachService.js';

export interface ParserOptions {
  filePath: string;
  fileName?: string;
}

export abstract class BaseParser {
  constructor(protected coachService: CoachService) {}

  /**
   * Main analysis method to be implemented by sub-classes
   */
  abstract analyze(rawData: unknown, options: ParserOptions): Promise<AnalyzedSession>;

  /**
   * Helper to recursively extract content from complex objects
   */
  protected extractContent(content: unknown): string {
    if (!content) return "";
    if (typeof content === 'string') return content;
    
    if (Array.isArray(content)) {
      return content.map(c => this.extractContent(c)).join("\n");
    }

    if (typeof content === 'object' && content !== null) {
      const obj = content as Record<string, unknown>;
      if (Array.isArray(obj.parts)) {
        return obj.parts.map((p: unknown) => typeof p === 'string' ? p : this.extractContent(p)).join("\n");
      }
      if (typeof obj.text === 'string') return obj.text;
      if (obj.value) return this.extractContent(obj.value);
    }

    return "";
  }
}
