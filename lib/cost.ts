// Pricing per million tokens (input / output)
const MODEL_RATES: Record<string, [number, number]> = {
  'claude-haiku-4-5-20251001': [0.8, 4.0],
  'claude-sonnet-4-6': [3.0, 15.0],
  'claude-opus-4-7': [15.0, 75.0],
};
const DEFAULT_RATES: [number, number] = [0.8, 4.0];

export function estimateUsd(
  inputTokens: number,
  outputTokens: number,
  model?: string,
): number {
  const [inputRate, outputRate] =
    (model ? MODEL_RATES[model] : undefined) ?? DEFAULT_RATES;
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}
