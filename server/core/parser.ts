/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Session Parser (Delegator)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { AnalyzedSession } from '../types/index.js';
import { CoachService } from './services/CoachService.js';
import { GeminiParser } from './parsers/GeminiParser.js';
import { ChatGPTParser } from './parsers/ChatGPTParser.js';
import { BaseParser } from './parsers/BaseParser.js';

export class SessionParser {
  private coachService: CoachService;
  private geminiParser: GeminiParser;
  private chatGPTParser: ChatGPTParser;

  constructor() {
    this.coachService = new CoachService();
    this.geminiParser = new GeminiParser(this.coachService);
    this.chatGPTParser = new ChatGPTParser(this.coachService);
  }

  /**
   * Main entry point for session analysis.
   * Detects the format and delegates to the appropriate parser.
   */
  async analyze(filePath: string): Promise<AnalyzedSession | AnalyzedSession[]> {
    const rawData = await fs.readFile(filePath, 'utf-8');
    let sessionData: any;
    try {
      sessionData = JSON.parse(rawData);
    } catch (err) {
      throw new Error(`Invalid JSON format: ${(err as Error).message}`);
    }

    if (!sessionData) {
      throw new Error('Invalid session data: Empty or null');
    }

    const fileName = path.basename(filePath, '.json');

    // Support ChatGPT export arrays
    if (Array.isArray(sessionData)) {
      const results: AnalyzedSession[] = [];
      for (const item of sessionData) {
        try {
          const parser = this.getParser(item);
          if (parser) {
            results.push(await parser.analyze(item, { filePath, fileName }));
          }
        } catch (e) {
          // Skip invalid entries in arrays
          console.warn(`[Parser] Skipping invalid session in ${fileName}`);
        }
      }
      return results;
    }

    const parser = this.getParser(sessionData);
    return parser.analyze(sessionData, { filePath, fileName });
  }

  /**
   * Detects session format based on JSON structure
   */
  private getParser(session: any): BaseParser {
    // Detect ChatGPT export format
    if (session.mapping && (session.conversation_id || session.id)) {
      return this.chatGPTParser;
    }
    
    // Default to Gemini parser
    return this.geminiParser;
  }

  // Exposed for backward compatibility or direct access if needed
  getCoachService(): CoachService {
    return this.coachService;
  }
}
