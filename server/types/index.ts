/**
 * Server-side alias for the shared contract.
 *
 * The single definition lives in `shared/src/session.ts`; this module only
 * re-exports it so existing server imports keep working. New code should
 * import from `@chat-analyze/shared` directly.
 */
export * from '@chat-analyze/shared';
