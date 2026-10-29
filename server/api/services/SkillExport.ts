import fs from 'node:fs';
import path from 'node:path';
import type { AnalyzedSession } from '../../types/index.js';

/** Removes characters that are unsafe in file names (and path separators). */
export function sanitizeSkillName(name: string): string {
  const sanitized = name
    .trim()
    .replace(/[/\\?%*:|"<>\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized.length > 0 ? sanitized : 'new-skill';
}

/** Renders the SKILL.md body for one session. */
export function buildSkillMarkdown(session: AnalyzedSession): string {
  const skillName =
    session.sessionTitle || session.projectName.split('/').pop() || 'new-skill';
  const firstQuestion =
    session.messages.find((message) => message.type === 'user')?.content ||
    'N/A';

  return [
    `# ${skillName}`,
    '',
    '## Instructions',
    session.expressionQuality.suggestion,
    '',
    '## Tools',
    session.stats.toolChain.join(', '),
    '',
    '## Examples',
    `- **Input**: ${firstQuestion}`,
    `- **Model**: ${session.modelId}`,
    '',
  ].join('\n');
}

/**
 * Writes exported skills into `exportsDir`.
 *
 * Writes go to a `.tmp` sibling first and are then renamed, so a crash cannot
 * leave a partially written SKILL.md behind.
 */
export class SkillExportService {
  constructor(private readonly exportsDir: string) {}

  exportSession(session: AnalyzedSession): string {
    const skillName =
      session.sessionTitle ||
      session.projectName.split('/').pop() ||
      'new-skill';
    const fileName = `${sanitizeSkillName(skillName)}-${session.sessionId.slice(0, 8)}.md`;
    const exportPath = path.join(this.exportsDir, fileName);
    const tempPath = `${exportPath}.tmp`;

    fs.mkdirSync(this.exportsDir, { recursive: true });
    fs.writeFileSync(tempPath, buildSkillMarkdown(session), 'utf-8');
    fs.renameSync(tempPath, exportPath);

    return exportPath;
  }
}
