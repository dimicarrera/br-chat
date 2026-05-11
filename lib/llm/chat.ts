import { anthropic } from './client';
import type { Message } from '../types';
import { buildSystemPrompt } from '../prompts/system';

export function streamChat(
  messages: Message[],
  assistantTurns: number,
  maxAssistantTurns: number,
) {
  const model = process.env.MODEL_CHAT ?? 'claude-haiku-4-5-20251001';
  const system = buildSystemPrompt(assistantTurns, maxAssistantTurns);

  const apiMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  return anthropic.messages.stream({
    model,
    max_tokens: 512,
    system,
    messages: apiMessages,
  });
}
