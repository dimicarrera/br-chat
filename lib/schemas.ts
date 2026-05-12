import { z } from 'zod';
import { NEGATIVE_EMOTIONS } from './types';

const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.number(),
});

export const SessionSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  endedAt: z.number().nullable(),
  messages: z.array(MessageSchema),
  assistantTurns: z.number(),
  maxAssistantTurns: z.number(),
});

export const ExtractionResultSchema = z.object({
  sessionId: z.string(),
  emotions: z.array(
    z.object({
      label: z.enum(NEGATIVE_EMOTIONS),
      intensity: z.enum(['low', 'mid', 'high']),
      evidenceQuote: z.string(),
      sourceMessageId: z.string(),
      rationale: z.string(),
    }),
  ),
  summary: z.string(),
  extractedAt: z.number(),
  model: z.string(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    usdEstimate: z.number(),
  }),
});
