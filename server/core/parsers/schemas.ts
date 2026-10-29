import { z } from 'zod';

/**
 * Runtime schemas for every raw payload a parser accepts.
 *
 * They are intentionally permissive (`passthrough`, optional fields) so that a
 * new upstream field can never break parsing, while the fields we actually
 * read are typed and validated. A schema failure surfaces as a parse warning,
 * never as a crash.
 */

/** Renders the first validation issue as "path: message" for warnings. */
export function describeZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.length > 0 ? issue.path.join('.') : 'payload';
  return `${path}: ${issue.message}`;
}

const thoughtSchema = z
  .object({
    subject: z.string().optional(),
    description: z.string().optional(),
    timestamp: z.string().optional(),
  })
  .passthrough();

const toolCallSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    args: z.record(z.string(), z.unknown()).optional(),
    result: z.unknown().optional(),
    status: z.enum(['success', 'failure', 'pending']).optional(),
    timestamp: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

const tokenUsageSchema = z
  .object({
    input: z.number().optional(),
    output: z.number().optional(),
    thoughts: z.number().optional(),
    total: z.number().optional(),
  })
  .passthrough();

export const geminiMessageSchema = z
  .object({
    id: z.string().optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    type: z.string().optional(),
    content: z.unknown().optional(),
    displayContent: z.unknown().optional(),
    model: z.string().optional(),
    thoughts: z.array(thoughtSchema).optional(),
    toolCalls: z.array(toolCallSchema).optional(),
    tokens: tokenUsageSchema.optional(),
  })
  .passthrough();

export const geminiSessionSchema = z
  .object({
    sessionId: z.string().optional(),
    projectName: z.string().optional(),
    projectHash: z.string().optional(),
    startTime: z.string().optional(),
    lastUpdated: z.string().optional(),
    messages: z.array(geminiMessageSchema),
  })
  .passthrough();

export type GeminiSession = z.infer<typeof geminiSessionSchema>;
export type GeminiMessage = z.infer<typeof geminiMessageSchema>;

const checkpointPartSchema = z
  .object({
    text: z.string().optional(),
    thought: z.boolean().optional(),
    functionCall: z
      .object({
        id: z.string().optional(),
        name: z.string(),
        args: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
    functionResponse: z
      .object({
        id: z.string(),
        name: z.string(),
        response: z.unknown(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const checkpointSchema = z
  .object({
    history: z.array(
      z
        .object({
          role: z.string(),
          parts: z.array(checkpointPartSchema).optional().default([]),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type CheckpointData = z.infer<typeof checkpointSchema>;

const chatGPTMessageSchema = z
  .object({
    id: z.string().optional(),
    author: z.object({ role: z.string().optional() }).passthrough().nullish(),
    recipient: z.string().optional(),
    content: z.unknown().optional(),
    create_time: z.number().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const chatGPTNodeSchema = z
  .object({
    parent: z.string().nullish(),
    message: chatGPTMessageSchema.nullish(),
  })
  .passthrough();

export const chatGPTExportSchema = z
  .object({
    id: z.string().optional(),
    conversation_id: z.string().optional(),
    title: z.string().optional(),
    current_node: z.string().optional(),
    create_time: z.number().nullish(),
    update_time: z.number().nullish(),
    mapping: z.record(z.string(), chatGPTNodeSchema),
  })
  .passthrough();

export type ChatGPTExport = z.infer<typeof chatGPTExportSchema>;
export type ChatGPTMessage = z.infer<typeof chatGPTMessageSchema>;

/** `content` fragment of a JSONL user turn: plain string or `{ text }`. */
const jsonlContentPartSchema = z.union([
  z.string(),
  z.object({ text: z.string().optional() }).passthrough(),
]);

export const jsonlMetadataSchema = z
  .object({
    sessionId: z.string().optional(),
    projectHash: z.string().optional(),
    startTime: z.string().optional(),
    lastUpdated: z.string().optional(),
    kind: z.string().optional(),
  })
  .passthrough();

export const jsonlSetEventSchema = z
  .object({ $set: z.record(z.string(), z.unknown()) })
  .passthrough();

export const jsonlUserTurnSchema = z
  .object({
    id: z.string().optional(),
    timestamp: z.string().optional(),
    type: z.literal('user'),
    content: z.array(jsonlContentPartSchema).optional(),
  })
  .passthrough();

export const jsonlGeminiTurnSchema = z
  .object({
    id: z.string().optional(),
    timestamp: z.string().optional(),
    type: z.literal('gemini'),
    content: z.string().optional(),
    model: z.string().optional(),
    thoughts: z.array(thoughtSchema).optional(),
    tokens: tokenUsageSchema.optional(),
    toolCalls: z
      .array(
        z
          .object({
            id: z.string().optional(),
            name: z.string(),
            args: z.record(z.string(), z.unknown()).optional(),
            result: z
              .object({
                functionResponse: z
                  .object({ response: z.unknown() })
                  .passthrough(),
              })
              .passthrough()
              .optional(),
            status: z.enum(['success', 'failure', 'pending']).optional(),
            timestamp: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const jsonlInfoTurnSchema = z
  .object({
    id: z.string().optional(),
    timestamp: z.string().optional(),
    type: z.literal('info'),
    content: z.string().optional(),
  })
  .passthrough();

export const jsonlRecordSchema = z.union([
  jsonlUserTurnSchema,
  jsonlGeminiTurnSchema,
  jsonlInfoTurnSchema,
]);

export type JsonlRecord = z.infer<typeof jsonlRecordSchema>;
export type JsonlGeminiTurn = z.infer<typeof jsonlGeminiTurnSchema>;
