import { EMOTION_DEFINITIONS } from './emotions';

export function buildExtractionPrompt(transcript: string): string {
  const labelBlock = Object.entries(EMOTION_DEFINITIONS)
    .map(([label, def]) => `  - ${label}: ${def}`)
    .join('\n');

  return `You are analyzing a conversation transcript to identify negative emotions expressed by the USER only (not the assistant).

Allowed emotion labels:
${labelBlock}

Transcript:
<transcript>
${transcript}
</transcript>

Rules:
- Only classify emotions that are explicitly stated or strongly implied in USER messages.
- evidenceQuote MUST be copied verbatim and exactly from a user message — it must be a substring of that message.
- sourceMessageId must be the ID shown in brackets before the user message the quote came from.
- Intensity: low = passing mention; mid = clearly stated; high = sustained or vivid.
- Write a one-sentence rationale per finding.
- If no negative emotion is clearly supported by the evidence, return an empty emotions array.
- summary: 1–2 neutral, non-judgmental sentences describing what the user talked about.

Use the report_emotions tool to return your findings.`.trim();
}
