import type { EmotionFinding } from '@/lib/types';
import { EMOTION_DEFINITIONS } from '@/lib/prompts/emotions';

const INTENSITY_CONFIG: Record<
  string,
  { container: string; badge: string; quoteBorder: string; label: string }
> = {
  low: {
    container: 'bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.15)]',
    badge: 'bg-[rgba(16,185,129,0.1)] text-[#34D399] border border-[rgba(16,185,129,0.2)]',
    quoteBorder: 'border-l-2 border-l-[rgba(16,185,129,0.3)]',
    label: 'text-[#34D399]',
  },
  mid: {
    container: 'bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]',
    badge: 'bg-[rgba(245,158,11,0.1)] text-[#FBBF24] border border-[rgba(245,158,11,0.2)]',
    quoteBorder: 'border-l-2 border-l-[rgba(245,158,11,0.35)]',
    label: 'text-[#FBBF24]',
  },
  high: {
    container: 'bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)]',
    badge: 'bg-[rgba(239,68,68,0.1)] text-[#F87171] border border-[rgba(239,68,68,0.2)]',
    quoteBorder: 'border-l-2 border-l-[rgba(239,68,68,0.35)]',
    label: 'text-[#F87171]',
  },
};

const INTENSITY_LABEL: Record<string, string> = {
  low: 'Low concern',
  mid: 'Moderate concern',
  high: 'High concern',
};

interface Props {
  finding: EmotionFinding;
}

export default function EmotionCard({ finding }: Props) {
  const { label, intensity, evidenceQuote, rationale } = finding;
  const config = INTENSITY_CONFIG[intensity] ?? INTENSITY_CONFIG.mid;

  return (
    <div className={`rounded-xl p-4 space-y-3 ${config.container}`}>
      <div className="flex items-center justify-between">
        <span className={`font-semibold capitalize text-sm ${config.label}`}>{label}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
          {INTENSITY_LABEL[intensity] ?? intensity}
        </span>
      </div>

      <blockquote className={`pl-3 text-sm leading-relaxed italic text-slate-300 ${config.quoteBorder}`}>
        &ldquo;{evidenceQuote}&rdquo;
      </blockquote>

      <div className="space-y-1">
        <p className="text-xs text-slate-400">{rationale}</p>
        <p className="text-xs text-slate-400">{EMOTION_DEFINITIONS[label]}</p>
      </div>
    </div>
  );
}
