import { DiscoveryService } from '../core/services/DiscoveryService.js';
import path from 'node:path';
import os from 'node:os';

async function main() {
  const service = new DiscoveryService();
  const watchPath = path.join(os.homedir(), '.gemini/tmp');

  console.log(`Scanning: ${watchPath}`);

  const results = await service.scan([watchPath]);

  const checkpoints = results.filter((r) =>
    path.basename(r.filePath).startsWith('checkpoint-'),
  );

  console.log(`--- Scan Summary ---`);
  console.log(`Total files found: ${results.length}`);
  console.log(`Checkpoints found: ${checkpoints.length}`);

  if (checkpoints.length > 0) {
    console.log('Sample checkpoints:');
    checkpoints
      .slice(0, 5)
      .forEach((c) =>
        console.log(`  - [${c.projectName}] ${path.basename(c.filePath)}`),
      );
  } else {
    console.log('No checkpoints found! Check the DiscoveryService logic.');
  }
}

main();
