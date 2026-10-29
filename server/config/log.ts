import { ServerConfig } from './index.js';

/** Prints the resolved configuration once at boot so path issues are visible. */
export function logResolvedConfig(config: ServerConfig): void {
  console.log('--- Gemini Chat Analyze & Evolver ---');
  console.log(
    `[System] Config source: ${config.watchPathsSource}${config.watchPathsSourcePath ? ` (${config.watchPathsSourcePath})` : ''}`,
  );
  console.log(`[System] Watch paths (${config.watchPaths.length}):`);
  config.watchPaths.forEach((watchPath) => console.log(`  - ${watchPath}`));
  console.log(`[System] Database: ${config.dbPath}`);
  console.log(`[System] Exports: ${config.exportsDir}`);
}
