import { describe, expect, it } from 'vitest';
import { XMLValidator } from 'fast-xml-parser';
import type { UserQuestionsSession } from '../types/index.js';
import {
  buildCoachAuditPrompt,
  buildSkillExtractionPrompt,
} from '../api/services/PromptBuilder.js';

const sessions: UserQuestionsSession[] = [
  {
    sessionId: 's-1',
    projectName: 'demo & friends',
    sessionTitle: 'A "quoted" <title>',
    startTime: '2026-01-01T00:00:00.000Z',
    filePath: '/tmp/chats/session<1>.json',
    questions: ['how do I flush <the> cache & restart?'],
  },
];

function conversationXml(prompt: string): string {
  const start = prompt.indexOf('<conversation_data>');
  const end = prompt.indexOf('</conversation_data>');
  return prompt.slice(start, end + '</conversation_data>'.length);
}

describe('PromptBuilder', () => {
  it('substitutes every placeholder and escapes interpolated values', () => {
    const prompt = buildCoachAuditPrompt({
      project: 'proj<&>',
      skillsDir: '/tmp/skills',
      sessions,
    });

    expect(prompt).not.toContain('{{');
    expect(prompt).toContain('proj&lt;&amp;&gt;');
    expect(prompt).toContain('demo &amp; friends');
    expect(prompt).toContain('flush &lt;the&gt; cache &amp; restart');
    expect(XMLValidator.validate(conversationXml(prompt))).toBe(true);
  });

  it('injects the skills directory into the skill-extraction template', () => {
    const prompt = buildSkillExtractionPrompt({
      project: 'demo',
      skillsDir: '/tmp/skills & patches',
      sessions,
    });

    expect(prompt).not.toContain('{{skillsDir}}');
    expect(prompt).toContain('/tmp/skills &amp; patches');
    expect(prompt).toContain('Skill Extraction Agent');
    expect(XMLValidator.validate(conversationXml(prompt))).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const context = { project: 'demo', skillsDir: '/tmp/skills', sessions };

    expect(buildCoachAuditPrompt(context)).toBe(buildCoachAuditPrompt(context));
  });

  it('falls back to "所有项目" when no project is given', () => {
    const prompt = buildCoachAuditPrompt({
      skillsDir: '/tmp/skills',
      sessions,
    });

    expect(prompt).toContain('[所有项目]');
  });
});
