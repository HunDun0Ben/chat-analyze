/**
 * Normalises a raw timestamp to an ISO string.
 *
 * Gemini exports use ISO strings, but older/synthetic payloads sometimes carry
 * epoch milliseconds. Both are accepted; anything else falls back to the
 * provided value (usually the file mtime) so parsing stays deterministic.
 */
export function toIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return fallback;
}
