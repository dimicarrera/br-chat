// Haiku 4.5: $0.80/M input, $4.00/M output
const INPUT_RATE = 0.8 / 1_000_000;
const OUTPUT_RATE = 4.0 / 1_000_000;

export function estimateUsd(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_RATE + outputTokens * OUTPUT_RATE;
}
