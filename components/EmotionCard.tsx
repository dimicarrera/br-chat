import type { EmotionFinding } from '@/lib/types';
import { EMOTION_DEFINITIONS } from '@/lib/prompts/emotions';

const INTENSITY_STYLES: Record<string, string> = {
  low: 'bg-blue-50 border-blue-200 text-blue-800',
  mid: 'bg-amber-50 border-amber-200 text-amber-800',
  high: 'bg-red-50 border-red-200 text-red-800',
};

interface Props {
  finding: EmotionFinding;
}

export default function EmotionCard({ finding }: Props) {
  const { label, intensity, evidenceQuote, rationale } = finding;
  const style = INTENSITY_STYLES[intensity] ?? INTENSITY_STYLES.mid;

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${style}`}>
      <div className="flex items-center gap-2">
        <span className="font-semibold capitalize text-sm">{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${style}`}>
          {intensity}
        </span>
      </div>
      <p className="text-xs opacity-70">{EMOTION_DEFINITIONS[label]}</p>
      <blockquote className="border-l-2 border-current pl-3 text-sm italic opacity-90">
        &ldquo;{evidenceQuote}&rdquo;
      </blockquote>
      <p className="text-xs opacity-70">{rationale}</p>
    </div>
  );
}
