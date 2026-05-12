import { z } from 'zod';
import { anthropic, DEFAULT_MODEL } from './client';
import { NEGATIVE_EMOTIONS } from '../types';
import type { Message, ExtractionResult, SessionId } from '../types';
import { buildExtractionPrompt } from '../prompts/extraction';
import { estimateUsd } from '../cost';

const ExtractionOutputSchema = z.object({
  emotions: z.array(
    z.object({
      label: z.enum(NEGATIVE_EMOTIONS),
      intensity: z.enum(['low', 'mid', 'high']),
      evidenceQuote: z.string().min(1),
      sourceMessageId: z.string(),
      rationale: z.string(),
    }),
  ),
  summary: z.string(),
});

const reportEmotionsTool = {
  name: 'report_emotions',
  description: 'Report identified negative emotions from the conversation transcript.',
  input_schema: {
    type: 'object' as const,
    properties: {
      emotions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', enum: [...NEGATIVE_EMOTIONS] },
            intensity: { type: 'string', enum: ['low', 'mid', 'high'] },
            evidenceQuote: { type: 'string' },
            sourceMessageId: { type: 'string' },
            rationale: { type: 'string' },
          },
          required: [
            'label',
            'intensity',
            'evidenceQuote',
            'sourceMessageId',
            'rationale',
          ],
        },
      },
      summary: { type: 'string' },
    },
    required: ['emotions', 'summary'],
  },
};

export async function extractEmotions(
  sessionId: SessionId,
  messages: Message[],
): Promise<ExtractionResult> {
  const model = process.env.MODEL_EXTRACT ?? DEFAULT_MODEL;

  const userMessages = messages.filter((m) => m.role === 'user');
  const transcript = userMessages
    .map((m) => `USER [${m.id}]: ${m.content}`)
    .join('\n\n');

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    tools: [reportEmotionsTool],
    tool_choice: { type: 'tool', name: 'report_emotions' },
    messages: [{ role: 'user', content: buildExtractionPrompt(transcript) }],
  });

  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Extraction did not return a tool_use block');
  }

  const raw = ExtractionOutputSchema.parse(toolBlock.input);

  // Drop findings whose evidenceQuote is not verbatim in the specific source message
  const messageMap = new Map(userMessages.map((m) => [m.id, m.content]));
  const validEmotions = raw.emotions.filter((e) => {
    const src = messageMap.get(e.sourceMessageId);
    return src !== undefined && src.includes(e.evidenceQuote);
  });

  const { input_tokens: inputTokens, output_tokens: outputTokens } = response.usage;

  return {
    sessionId,
    emotions: validEmotions,
    summary: raw.summary,
    extractedAt: Date.now(),
    model,
    usage: { inputTokens, outputTokens, usdEstimate: estimateUsd(inputTokens, outputTokens, model) },
  };
}
