/**
 * Logic Verification Script
 */
import { SessionManager } from './server/core/manager.js';
import path from 'node:path';
import os from 'node:os';

async function verify() {
  const watchPath = path.join(os.homedir(), '.gemini/tmp');
  const manager = new SessionManager(watchPath);

  console.log(`\n1. [Initialization] Scanning ${watchPath}...`);
  await manager.init();

  console.log('\n2. [Projects List] Calling manager.getProjects()...');
  const projects = manager.getProjects();
  console.log('Detected Projects:', JSON.stringify(projects, null, 2));

  if (projects.length > 0) {
    const firstProject = projects[0];
    console.log(`\n3. [Sessions for Project] Calling manager.getSessionsByProject("${firstProject}")...`);
    const sessions = manager.getSessionsByProject(firstProject);
    console.log(`Found ${sessions.length} sessions in project "${firstProject}".`);
    
    if (sessions.length > 0) {
      console.log('Sample Session Sample:');
      console.log(`  - ID: ${sessions[0].sessionId}`);
      console.log(`  - Project Name (Injected): ${sessions[0].projectName}`);
    }
  }

  console.log('\n--- Verification Finished ---');
}

verify().catch(console.error);
