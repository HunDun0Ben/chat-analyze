


import { SessionParser } from '../core/parser.js';
import path from 'node:path';

async function main() {
  const parser = new SessionParser();
  const filePath = '/home/ben/.gemini/tmp/redis/checkpoint-%22redis%20base%20dir%22.json';
  
  console.log(`Testing parsing of: ${path.basename(filePath)}`);
  
  try {
    const result = await parser.analyze(filePath);
    const sessions = Array.isArray(result) ? result : [result];
    
    sessions.forEach(s => {
      console.log('--- Result ---');
      console.log(`Project: ${s.projectName}`);
      console.log(`Title: ${s.sessionTitle}`);
      console.log(`Messages: ${s.messages.length}`);
      console.log(`Tool Calls: ${s.stats.toolChain.join(', ')}`);
      
      const thoughts = s.messages.flatMap(m => m.thoughts || []);
      console.log(`Thoughts Found: ${thoughts.length}`);
    });
  } catch (err) {
    console.error('Parsing failed:', err);
  }
}

main();
