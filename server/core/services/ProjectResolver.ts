import { AnalyzedSession } from '../../types/index.js';
import {
  chatgptProjectName,
  findWatchRoot,
  geminiProjectName,
} from './discovery/projectNaming.js';

export type ProviderId = AnalyzedSession['provider'];

interface ProviderNaming {
  /** True when the parser could not derive a meaningful name from content. */
  isPlaceholder(projectName: string): boolean;
  resolve(filePath: string, watchRoot: string): Promise<string>;
}

const GEMINI_PLACEHOLDERS = new Set(['Imported', 'Unknown']);
const CHATGPT_PLACEHOLDERS = new Set(['ChatGPT Import', 'Imported', 'Unknown']);

/**
 * Single source of truth for provider-specific project naming.
 *
 * Both the boot scan and the watcher go through `ProjectResolver`, which reads
 * these rules; parsers only provide a placeholder. Adding a provider means
 * adding one entry here.
 */
export const PROVIDER_NAMING: Record<ProviderId, ProviderNaming> = {
  gemini: {
    isPlaceholder: (projectName) =>
      !projectName ||
      GEMINI_PLACEHOLDERS.has(projectName) ||
      /^[a-f0-9]{64}$/.test(projectName),
    resolve: (filePath, watchRoot) => geminiProjectName(filePath, watchRoot),
  },
  chatgpt: {
    isPlaceholder: (projectName) =>
      !projectName || CHATGPT_PLACEHOLDERS.has(projectName),
    resolve: async (filePath, watchRoot) =>
      chatgptProjectName(filePath, watchRoot),
  },
};

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

    return PROVIDER_NAMING[provider].resolve(filePath, watchRoot);
  }

  /**
   * Whether a parser-provided project name is a placeholder that should be
   * replaced by the resolved name.
   */
  isPlaceholder(provider: ProviderId, projectName: string): boolean {
    return PROVIDER_NAMING[provider].isPlaceholder(projectName);
  }
}
