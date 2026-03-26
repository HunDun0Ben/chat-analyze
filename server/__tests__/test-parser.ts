/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Parser & Storage Test Script
 */

import { SessionParser } from '../core/parser.js';
import { SessionStorage } from '../db/storage.js';
import path from 'node:path';
import fs from 'node:fs/promises';

async function runTest() {
  const parser = new SessionParser();
  const storage = new SessionStorage('./chat_analyze.db');
  const chatsDir = '/home/ben/.gemini/tmp/chat-analyze/chats/';
  
  try {
    const files = await fs.readdir(chatsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log("No session files found.");
      return;
    }

    const file = jsonFiles[0];
    const filePath = path.join(chatsDir, file);
    const result = await parser.analyze(filePath);
    const sessions = Array.isArray(result) ? result : [result];
    
    console.log(`\n--- Single File Storage Test: ${file} ---`);
    for (const session of sessions) {
      storage.saveSession(session);
    }
    console.log(`- Saved ${sessions.length} session(s) to SQLite.`);

    const saved = storage.getSessions({ limit: 1 });
    if (saved.length > 0) {
      console.log(`- Successfully retrieved session from DB:`);
      console.log(`  * ID:       ${saved[0].sessionId}`);
      console.log(`  * Category: ${saved[0].category}`);
      console.log(`  * Score:    ${saved[0].expressionQuality.score}`);
    }

  } catch (err) {
    console.error('Analysis or Storage failed:', err);
  } finally {
    storage.close();
  }
}

runTest();
