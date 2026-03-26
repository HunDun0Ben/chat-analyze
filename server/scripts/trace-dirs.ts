/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Directory Trace Script
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

async function main() {
  const watchPath = path.join(os.homedir(), '.gemini/tmp');
  const entries = await fs.readdir(watchPath, { withFileTypes: true });
  
  console.log(`Contents of ${watchPath}:`);
  for (const entry of entries) {
    const isDir = entry.isDirectory();
    console.log(`  ${isDir ? '[DIR]' : '[FILE]'} ${entry.name}`);
    
    if (entry.name === 'redis' && isDir) {
       const subEntries = await fs.readdir(path.join(watchPath, entry.name));
       console.log(`    Sub-contents of redis: ${subEntries.length} items`);
    }
  }
}

main();
