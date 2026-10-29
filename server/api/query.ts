import { z } from 'zod';
import { HttpError } from './middleware/errorHandler.js';

/**
 * Query schemas are the contract for the REST API. Parsing here (instead of
 * casting `req.query` values) turns bad input into a 400 with the offending
 * field name instead of silently disabling a filter.
 */
const taskCategorySchema = z.enum([
  'Coding',
  'Learning',
  'Ops',
  'Arch',
  'Investigate',
  'Research',
  'General',
]);

const optionalScore = z.coerce.number().int().min(0).max(100).optional();

const userQuestionsQuerySchema = z.object({
  project: z.string().min(1).optional(),
  category: taskCategorySchema.optional(),
  minScore: optionalScore,
  maxScore: optionalScore,
  /** Bounded: the endpoint is a local dashboard, not an export API. */
  limit: z.coerce.number().int().min(1).max(500).default(500),
  offset: z.coerce.number().int().min(0).default(0),
  format: z.enum(['text', 'prompt']).optional(),
  includePrompt: z.enum(['true', 'false']).optional(),
  mode: z.enum(['skill']).optional(),
});

const projectsQuerySchema = z.object({
  provider: z.enum(['gemini', 'chatgpt']).optional(),
});

function parse<T extends z.ZodType>(schema: T, query: unknown): z.output<T> {
  const result = schema.safeParse(query);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const field = issue.path.join('.') || 'query';
  throw new HttpError(400, `Invalid query parameter: ${field}`, field);
}

export function parseUserQuestionsQuery(query: unknown) {
  return parse(userQuestionsQuerySchema, query);
}

export function parseProjectsQuery(query: unknown) {
  return parse(projectsQuerySchema, query);
}
