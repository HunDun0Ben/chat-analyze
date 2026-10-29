import { isRecord } from './guards.js';

/**
 * Recursively extracts text from the many shapes providers use for message
 * content (`string`, `{ text }`, `{ parts: [...] }`, arrays of the above).
 *
 * Lives here instead of `BaseParser` so parsers do not inherit a default that
 * only one provider understands.
 */
export function extractContent(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content.map((entry) => extractContent(entry)).join('\n');
  }

  if (isRecord(content)) {
    const obj = content;
    if (Array.isArray(obj.parts)) {
      return obj.parts
        .map((part: unknown) =>
          typeof part === 'string' ? part : extractContent(part),
        )
        .join('\n');
    }
    if (typeof obj.text === 'string') return obj.text;
    if (obj.value) return extractContent(obj.value);
  }

  return '';
}
