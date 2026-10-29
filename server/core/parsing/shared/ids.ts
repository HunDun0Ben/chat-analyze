import crypto from 'node:crypto';

/**
 * Deterministic id for sessions that do not carry their own identifier.
 *
 * The id must be stable across restarts: it is used as the in-memory map key
 * and as the SQLite primary key, so a random value would rewrite every row on
 * every scan.
 */
export function stableSessionId(filePath: string, index?: number): string {
  const input = index === undefined ? filePath : `${filePath}:${index}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolves a session id from the raw payload, falling back to a stable hash of
 * the file path. Parsers must never emit an empty id: an empty key makes every
 * id-less session overwrite the previous one in `SessionManager`.
 */
export function resolveSessionId(
  source: {
    sessionId?: unknown;
    conversation_id?: unknown;
    id?: unknown;
  },
  filePath: string,
  index?: number,
): string {
  return (
    nonEmptyString(source.sessionId) ??
    nonEmptyString(source.conversation_id) ??
    nonEmptyString(source.id) ??
    stableSessionId(filePath, index)
  );
}
