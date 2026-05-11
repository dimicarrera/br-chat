export type SessionId = string;

export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface Session {
  id: SessionId;
  createdAt: number;
  endedAt: number | null;
  messages: Message[];
  assistantTurns: number;
  maxAssistantTurns: number;
}

export const NEGATIVE_EMOTIONS = [
  'sadness',
  'anxiety',
  'frustration',
  'shame',
  'resentment',
  'disappointment',
  'anger',
  'burnout',
  'envy',
  'loneliness',
  'jealousy',
] as const;

export type EmotionLabel = (typeof NEGATIVE_EMOTIONS)[number];
export type Intensity = 'low' | 'mid' | 'high';

export interface EmotionFinding {
  label: EmotionLabel;
  intensity: Intensity;
  evidenceQuote: string;
  sourceMessageId: string;
  rationale: string;
}

export interface ExtractionResult {
  sessionId: SessionId;
  emotions: EmotionFinding[];
  summary: string;
  extractedAt: number;
  model: string;
  usage: { inputTokens: number; outputTokens: number; usdEstimate: number };
}
