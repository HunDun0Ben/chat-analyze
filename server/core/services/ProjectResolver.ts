import { AnalyzedSession } from '../../types/index.js';
import {
  chatgptProjectName,
  findWatchRoot,
  genericProjectName,
  geminiProjectName,
} from './discovery/projectNaming.js';

export type ProviderId = AnalyzedSession['provider'];

/**
 * Resolves the final project name for a parsed session. Discovery only knows
 * about files; the provider-specific naming rules live here so both the boot
 * scan and the watcher produce identical results.
 */
export class ProjectResolver {
  async resolve(
    provider: ProviderId,
    filePath: string,
    watchPaths: string[],
  ): Promise<string> {
    const watchRoot = findWatchRoot(filePath, watchPaths);
    if (!watchRoot) return 'Unknown';

    switch (provider) {
      case 'gemini':
        return geminiProjectName(filePath, watchRoot);
      case 'chatgpt':
        return chatgptProjectName(filePath, watchRoot);
      default:
        return genericProjectName(filePath, watchRoot);
    }
  }

  /**
   * Whether a parser-provided project name is a placeholder that should be
   * replaced by the resolved name.
   */
  isPlaceholder(provider: ProviderId, projectName: string): boolean {
    if (!projectName) return true;

    if (provider === 'chatgpt') {
      return (
        projectName === 'ChatGPT Import' ||
        projectName === 'Imported' ||
        projectName === 'Unknown'
      );
    }

    if (provider === 'gemini') {
      return (
        projectName === 'Imported' ||
        projectName === 'Unknown' ||
        /^[a-f0-9]{64}$/.test(projectName)
      );
    }

    return projectName === 'Imported' || projectName === 'Unknown';
  }
}
