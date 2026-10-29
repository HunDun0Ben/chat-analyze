import { z } from 'zod';
import { PROVIDERS } from './session.js';

/**
 * Wire contracts for the dashboard API.
 *
 * Types are inferred from the schemas so the server can assert its handlers
 * produce exactly what the UI consumes (`server/__tests__/api_contract.spec.ts`
 * parses real service output with these schemas).
 */

export const providerSchema = z.enum(PROVIDERS);

export const statsSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  avgScore: z.number().min(0).max(100),
  totalTokens: z.number().nonnegative(),
});
export type StatsSummary = z.infer<typeof statsSummarySchema>;

export const statsTimelinePointSchema = z.object({
  /** UTC day, `YYYY-MM-DD`. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  avgScore: z.number().min(0).max(100),
  sessionCount: z.number().int().nonnegative(),
  totalTokens: z.number().nonnegative(),
});
export type StatsTimelinePoint = z.infer<typeof statsTimelinePointSchema>;

export const modelStatSchema = z.object({
  modelId: z.string(),
  sessionCount: z.number().int().nonnegative(),
  avgScore: z.number(),
  avgTokens: z.number(),
  avgTurns: z.number(),
});
export type ModelStat = z.infer<typeof modelStatSchema>;

export const projectStatSchema = z.object({
  projectName: z.string(),
  sessionCount: z.number().int().nonnegative(),
  totalQuestions: z.number().int().nonnegative(),
  avgScore: z.number(),
});
export type ProjectStat = z.infer<typeof projectStatSchema>;

/** Row returned by `GET /api/sessions/summary` (sidebar + search index). */
export const sessionIndexEntrySchema = z.object({
  sessionId: z.string(),
  sessionTitle: z.string().optional(),
  projectName: z.string(),
  provider: providerSchema,
  startTime: z.string(),
  isCheckpoint: z.boolean().optional(),
  expressionQuality: z.object({ score: z.number() }),
  /** First user question, used when the session has no explicit title. */
  firstMessage: z.string(),
});
export type SessionIndexEntry = z.infer<typeof sessionIndexEntrySchema>;

/** Paginated body of `GET /api/user-questions`. */
export const userQuestionsResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  data: z.array(
    z.object({
      sessionId: z.string(),
      projectName: z.string(),
      sessionTitle: z.string().optional(),
      startTime: z.string(),
      questions: z.array(z.string()),
      filePath: z.string().optional(),
    }),
  ),
});
export type UserQuestionsResponse = z.infer<typeof userQuestionsResponseSchema>;
