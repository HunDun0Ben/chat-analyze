import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserQuestionsSession } from '../../types/index.js';
import { buildSessionXmlElement, escapeXml } from '../prompts/format.js';

const PROMPTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'prompts',
);

export type PromptKind = 'coach-audit' | 'skill-extraction';

export interface PromptContext {
  /** Project label shown in the instruction block. */
  project?: string;
  /** Absolute export directory the skill agent may write to. */
  skillsDir: string;
  sessions: UserQuestionsSession[];
}

type PromptVars = Record<'project' | 'skillsDir' | 'conversation_data', string>;

const templateCache = new Map<string, string>();

function readTemplate(kind: PromptKind): string {
  const filePath = path.join(PROMPTS_DIR, `${kind}.md`);
  const cached = templateCache.get(filePath);
  if (cached !== undefined) return cached;

  const template = fs.readFileSync(filePath, 'utf-8');
  templateCache.set(filePath, template);
  return template;
}

/**
 * Replaces `{{name}}` placeholders. Throws on a leftover placeholder so a
 * typo in a template fails the prompt tests instead of reaching the model.
 */
function render(template: string, vars: PromptVars): string {
  const rendered = template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = vars[name as keyof PromptVars];
    if (value === undefined) {
      throw new Error(`[PromptBuilder] Unknown placeholder ${match}`);
    }
    return value;
  });

  const leftover = rendered.match(/\{\{\w+\}\}/);
  if (leftover) {
    throw new Error(`[PromptBuilder] Unresolved placeholder ${leftover[0]}`);
  }

  return rendered;
}

/**
 * Builds the audit / skill-extraction prompt from the markdown template.
 *
 * Templates live in `api/prompts/*.md` so prompt changes are reviewable as
 * plain text; the build copies them next to the compiled JS.
 */
export function buildPrompt(kind: PromptKind, context: PromptContext): string {
  const sessionsXml = context.sessions
    .map((session) => buildSessionXmlElement(session))
    .join('\n');

  return render(readTemplate(kind), {
    project: escapeXml(context.project?.trim() || '所有项目'),
    skillsDir: escapeXml(context.skillsDir),
    conversation_data: sessionsXml,
  });
}

export function buildCoachAuditPrompt(context: PromptContext): string {
  return buildPrompt('coach-audit', context);
}

export function buildSkillExtractionPrompt(context: PromptContext): string {
  return buildPrompt('skill-extraction', context);
}
