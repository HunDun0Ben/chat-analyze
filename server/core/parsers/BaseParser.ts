/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Base Parser Interface
 */

import { AnalyzedSession } from '../../types/index.js';
import { CoachService } from '../services/CoachService.js';

export interface ParserOptions {
  filePath: string;
}

export abstract class BaseParser {
  constructor(protected coachService: CoachService) {}

  /**
   * Main analysis method to be implemented by sub-classes
   */
  abstract analyze(rawData: any, options: ParserOptions): Promise<AnalyzedSession>;

  /**
   * Helper to recursively extract content from complex objects
   */
  protected extractContent(content: any): string {
    if (!content) return "";
    if (typeof content === 'string') return content;
    
    if (Array.isArray(content)) {
      return content.map(c => this.extractContent(c)).join("\n");
    }

    if (typeof content === 'object') {
      if (Array.isArray(content.parts)) {
        return content.parts.map((p: any) => typeof p === 'string' ? p : this.extractContent(p)).join("\n");
      }
      if (content.text) return content.text;
      if (content.value) return this.extractContent(content.value);
    }

    return "";
  }
}
