import { DiscoveryService } from '../core/services/DiscoveryService.js';
import path from 'node:path';
import os from 'node:os';

async function main() {
  const service = new DiscoveryService();
  const watchPath = path.join(os.homedir(), '.gemini/tmp');

  const results = await service.scan([watchPath]);

  console.log(`Checking files in redis directory...`);
  const redisFiles = results.filter((r) => r.filePath.includes('/redis/'));

  console.log(`Found ${redisFiles.length} files in redis/`);
  redisFiles.forEach((r) => {
    console.log(`  - [${r.projectName}] ${path.basename(r.filePath)}`);
  });
}

main();
