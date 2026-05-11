import { extractEmotions } from '../lib/llm/extract';
import type { Message, EmotionLabel, Intensity } from '../lib/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const INTENSITY_ORDER: Record<Intensity, number> = { low: 0, mid: 1, high: 2 };

interface MustIncludeSpec {
  label: EmotionLabel;
  min_intensity?: Intensity;
}

interface EvalCase {
  id: string;
  description: string;
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>;
  expected: {
    must_include: MustIncludeSpec[];
    may_include: Array<{ label: EmotionLabel }>;
    must_not_include: EmotionLabel[];
  };
}

interface CaseResult {
  caseId: string;
  description: string;
  predictedLabels: EmotionLabel[];
  mustIncludeViolations: string[];
  mustNotIncludeViolations: string[];
  precision: number;
  recall: number;
  f1: number;
  allQuotesValid: boolean;
  passed: boolean;
  usdCost: number;
}

interface RunSummary {
  ranAt: string;
  model: string;
  cases: CaseResult[];
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  passRate: number;
  quoteAccuracy: number;
  meanUsdPerCase: number;
  totalUsd: number;
}

function f1Score(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function computeMetrics(
  mustInclude: MustIncludeSpec[],
  mustNotInclude: EmotionLabel[],
  findings: Array<{ label: EmotionLabel; intensity: Intensity }>,
) {
  const mustNotSet = new Set(mustNotInclude);

  // TP: required labels found with sufficient intensity
  let tp = 0;
  const mustIncludeViolations: string[] = [];
  for (const spec of mustInclude) {
    const found = findings.find((e) => e.label === spec.label);
    if (!found) {
      mustIncludeViolations.push(`missing: ${spec.label}`);
      continue;
    }
    if (
      spec.min_intensity !== undefined &&
      INTENSITY_ORDER[found.intensity] < INTENSITY_ORDER[spec.min_intensity]
    ) {
      mustIncludeViolations.push(
        `${spec.label} intensity too low: got ${found.intensity}, need >= ${spec.min_intensity}`,
      );
      continue;
    }
    tp++;
  }

  // FP: forbidden labels found
  const mustNotIncludeViolations: string[] = [];
  for (const f of findings) {
    if (mustNotSet.has(f.label)) {
      mustNotIncludeViolations.push(`forbidden: ${f.label}`);
    }
  }
  const fp = mustNotIncludeViolations.length;

  // Standard NLP: precision=1 when no predictions (vacuously true); recall=1 when nothing required
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = mustInclude.length === 0 ? 1 : tp / mustInclude.length;

  return {
    precision,
    recall,
    f1: f1Score(precision, recall),
    mustIncludeViolations,
    mustNotIncludeViolations,
    passed: mustIncludeViolations.length === 0 && mustNotIncludeViolations.length === 0,
  };
}

function transcriptToMessages(
  transcript: EvalCase['transcript'],
): Message[] {
  return transcript.map((t) => ({
    id: uuidv4(),
    role: t.role,
    content: t.content,
    createdAt: Date.now(),
  }));
}

async function main() {
  const casesPath = path.join(__dirname, 'cases.json');
  const cases: EvalCase[] = JSON.parse(await fs.readFile(casesPath, 'utf-8'));

  console.log(`Running ${cases.length} eval cases…\n`);

  const results: CaseResult[] = [];

  for (const c of cases) {
    process.stdout.write(`  ${c.id}: `);
    try {
      const messages = transcriptToMessages(c.transcript);
      const result = await extractEmotions(c.id, messages);
      const predictedLabels = result.emotions.map((e) => e.label);

      const userTexts = c.transcript
        .filter((t) => t.role === 'user')
        .map((t) => t.content);

      const allQuotesValid = result.emotions.every((e) =>
        userTexts.some((text) => text.includes(e.evidenceQuote)),
      );

      const { precision, recall, f1, mustIncludeViolations, mustNotIncludeViolations, passed } =
        computeMetrics(c.expected.must_include, c.expected.must_not_include, result.emotions);

      results.push({
        caseId: c.id,
        description: c.description,
        predictedLabels,
        mustIncludeViolations,
        mustNotIncludeViolations,
        precision,
        recall,
        f1,
        allQuotesValid,
        passed,
        usdCost: result.usage.usdEstimate,
      });

      const status = passed ? '✓' : '✗';
      console.log(
        `${status} F1=${f1.toFixed(2)} P=${precision.toFixed(2)} R=${recall.toFixed(2)} quotes=${allQuotesValid ? '✓' : '✗'} $${result.usage.usdEstimate.toFixed(5)}`,
      );
      if (mustIncludeViolations.length > 0)
        console.log(`      must_include: ${mustIncludeViolations.join(', ')}`);
      if (mustNotIncludeViolations.length > 0)
        console.log(`      must_not_include: ${mustNotIncludeViolations.join(', ')}`);
    } catch (err) {
      console.log(`ERROR: ${err}`);
      results.push({
        caseId: c.id,
        description: c.description,
        predictedLabels: [],
        mustIncludeViolations: ['exception'],
        mustNotIncludeViolations: [],
        precision: 0,
        recall: 0,
        f1: 0,
        allQuotesValid: false,
        passed: false,
        usdCost: 0,
      });
    }
  }

  const macroPrecision = results.reduce((s, r) => s + r.precision, 0) / results.length;
  const macroRecall = results.reduce((s, r) => s + r.recall, 0) / results.length;
  const macroF1 = results.reduce((s, r) => s + r.f1, 0) / results.length;
  const passRate = results.filter((r) => r.passed).length / results.length;
  const quoteAccuracy = results.filter((r) => r.allQuotesValid).length / results.length;
  const totalUsd = results.reduce((s, r) => s + r.usdCost, 0);
  const meanUsdPerCase = totalUsd / results.length;
  const model = process.env.MODEL_EXTRACT ?? 'claude-haiku-4-5-20251001';

  const summary: RunSummary = {
    ranAt: new Date().toISOString(),
    model,
    cases: results,
    macroPrecision,
    macroRecall,
    macroF1,
    passRate,
    quoteAccuracy,
    meanUsdPerCase,
    totalUsd,
  };

  const outPath = path.join(__dirname, 'last-run.json');
  await fs.writeFile(outPath, JSON.stringify(summary, null, 2));

  console.log(`
─────────────────────────────────────
Pass rate       : ${(passRate * 100).toFixed(1)}% (${results.filter((r) => r.passed).length}/${results.length})
Macro precision : ${macroPrecision.toFixed(3)}
Macro recall    : ${macroRecall.toFixed(3)}
Macro F1        : ${macroF1.toFixed(3)}
Quote accuracy  : ${(quoteAccuracy * 100).toFixed(1)}%
Mean USD/case   : $${meanUsdPerCase.toFixed(5)}
Total USD       : $${totalUsd.toFixed(4)}
─────────────────────────────────────
Results saved to evals/last-run.json
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
