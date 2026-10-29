import { describe, expect, it } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import {
  buildSessionXmlElement,
  escapeXml,
  formatSessionTitle,
} from '../api/prompts/format.js';
import { UserQuestionsSession } from '../types/index.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
});

function makeSession(
  overrides: Partial<UserQuestionsSession> = {},
): UserQuestionsSession {
  return {
    sessionId: 'session-1',
    projectName: 'demo-project',
    startTime: '2026-01-01T00:00:00.000Z',
    questions: ['如何重置 Redis 缓存?'],
    ...overrides,
  };
}

describe('escapeXml', () => {
  it('escapes every character that breaks XML', () => {
    expect(escapeXml('A & B <tag> "quoted" \'single\'')).toBe(
      'A &amp; B &lt;tag&gt; &quot;quoted&quot; &apos;single&apos;',
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeXml('普通文本 123')).toBe('普通文本 123');
  });
});

describe('formatSessionTitle', () => {
  it('prefers the explicit session title', () => {
    expect(
      formatSessionTitle({ sessionTitle: '显式标题', questions: ['问题'] }),
    ).toBe('显式标题');
  });

  it('falls back to the first question truncated to 50 chars', () => {
    const question = 'a'.repeat(80);
    expect(formatSessionTitle({ questions: [question] })).toBe(
      `${'a'.repeat(50)}...`,
    );
  });

  it('never returns the literal "undefined..."', () => {
    expect(formatSessionTitle({ questions: [] })).toBe('Untitled');
    expect(formatSessionTitle({ questions: ['   '] })).toBe('Untitled');
  });
});

describe('buildSessionXmlElement', () => {
  it('produces well-formed XML for hostile titles and questions', () => {
    const session = makeSession({
      sessionTitle: 'A & B "quote" <x>',
      projectName: 'R&D <lab>',
      filePath: '/tmp/a&b/session.json',
      questions: ['if (a < b && c > d) { fix(); }'],
    });

    const parsed = parser.parse(
      `<root>${buildSessionXmlElement(session)}</root>`,
    );
    const element = parsed.root.session;

    expect(element.id).toBe('session-1');
    expect(element.project).toBe('R&D <lab>');
    expect(element.title).toBe('A & B "quote" <x>');
    expect(element.path).toBe('/tmp/a&b/session.json');
    expect(element.questions.q).toBe('if (a < b && c > d) { fix(); }');
  });

  it('does not emit a bare "&" outside of entities', () => {
    const xml = buildSessionXmlElement(
      makeSession({ sessionTitle: 'A & B', questions: ['x & y'] }),
    );

    expect(xml).toContain('&amp;');
    expect(/&(?!(amp|lt|gt|quot|apos);)/.test(xml)).toBe(false);
  });

  it('keeps multiple questions in order', () => {
    const parsed = parser.parse(
      `<root>${buildSessionXmlElement(makeSession({ questions: ['q1', 'q2'] }))}</root>`,
    );

    expect(parsed.root.session.questions.q).toEqual(['q1', 'q2']);
  });
});
