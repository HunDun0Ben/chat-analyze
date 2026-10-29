import { UserQuestionsSession } from '../../types/index.js';

/**
 * Characters that would break XML when interpolated into text or attribute
 * values. Prompts are consumed by LLMs and external agents that parse them as
 * XML, so every interpolation must go through `escapeXml`.
 */
const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ENTITIES[char] ?? char);
}

/**
 * Title fallback used by both the text and the prompt renderers. Missing
 * titles used to serialise as the literal string "undefined...".
 */
export function formatSessionTitle(
  session: Pick<UserQuestionsSession, 'sessionTitle' | 'questions'>,
): string {
  const explicit = session.sessionTitle?.trim();
  if (explicit) return explicit;

  const firstQuestion = session.questions[0]?.trim();
  return firstQuestion ? `${firstQuestion.slice(0, 50)}...` : 'Untitled';
}

/**
 * Renders a single session as an XML element. Kept as a pure function so the
 * generated prompt can be validated in tests without booting the HTTP server.
 */
export function buildSessionXmlElement(session: UserQuestionsSession): string {
  const questions = session.questions
    .map((question) => `      <q>${escapeXml(question)}</q>`)
    .join('\n');

  return [
    `  <session id="${escapeXml(session.sessionId)}" project="${escapeXml(session.projectName)}" title="${escapeXml(formatSessionTitle(session))}" path="${escapeXml(session.filePath ?? '')}">`,
    '    <questions>',
    questions,
    '    </questions>',
    '  </session>',
  ].join('\n');
}
