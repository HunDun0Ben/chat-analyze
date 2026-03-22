/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Entry Point
 */

import { ChatWatcher } from './watcher.js';
import path from 'node:path';
import os from 'node:os';

const homeDir = os.homedir();
const watchPath = path.join(homeDir, '.gemini/tmp');

const watcher = new ChatWatcher(watchPath);
watcher.start();

console.log('Gemini Chat Analyze is now running.');
console.log('Press Ctrl+C to stop.');

process.on('SIGINT', async () => {
  console.log('\nStopping watcher...');
  try {
    await watcher.stop();
  } catch (err) {
    console.error('Error during shutdown:', err);
  }
  process.exit(0);
});
