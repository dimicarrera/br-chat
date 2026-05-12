import { notFound } from 'next/navigation';
import Link from 'next/link';
import EmotionCard from '@/components/EmotionCard';
import { getSession, getExtraction } from '@/lib/storage/sessions';

interface Props {
  params: Promise<{ sessionId: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ResultPage({ params }: Props) {
  const { sessionId } = await params;

  if (!UUID_RE.test(sessionId)) notFound();

  const [session, extraction] = await Promise.all([
    getSession(sessionId),
    getExtraction(sessionId),
  ]);

  if (!session || !extraction) notFound();

  const { emotions, summary, usage, extractedAt } = extraction;

  const date = new Date(extractedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sessionRef = sessionId.slice(0, 8).toUpperCase();

  const high = emotions.filter((e) => e.intensity === 'high');
  const mid = emotions.filter((e) => e.intensity === 'mid');
  const low = emotions.filter((e) => e.intensity === 'low');
  const sorted = [...high, ...mid, ...low];

  return (
    <div className="min-h-screen bg-[#050709]">
      <div className="pointer-events-none fixed top-0 left-0 right-0 h-px bg-[linear-gradient(90deg,transparent,rgba(99,102,241,0.4),transparent)]" />

      <div className="max-w-[680px] mx-auto px-5 py-12 space-y-8">

        <header className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.25)]">
              <span className="text-[9px] font-bold text-[#818CF8]">BC</span>
            </div>
            <span className="text-sm font-semibold text-slate-200">BR-Chat</span>
            <span className="text-slate-700" aria-hidden="true">·</span>
            <span className="text-xs text-slate-500">Wellbeing Report</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Session {sessionRef}</h1>
            <p className="text-sm text-slate-600 mt-1">{date}</p>
          </div>
        </header>

        <div className="rounded-2xl p-5 bg-[#0D1117] border border-[rgba(255,255,255,0.06)]">
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-[#475569] mb-3">
            Summary
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
        </div>

        {emotions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {high.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 bg-[rgba(239,68,68,0.1)] text-[#F87171] border border-[rgba(239,68,68,0.2)]">
                <span className="inline-block w-[5px] h-[5px] rounded-full bg-[#EF4444]" aria-hidden="true" />
                {high.length} high concern{high.length > 1 ? 's' : ''}
              </span>
            )}
            {mid.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 bg-[rgba(245,158,11,0.1)] text-[#FBBF24] border border-[rgba(245,158,11,0.2)]">
                <span className="inline-block w-[5px] h-[5px] rounded-full bg-[#F59E0B]" aria-hidden="true" />
                {mid.length} moderate concern{mid.length > 1 ? 's' : ''}
              </span>
            )}
            {low.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 bg-[rgba(16,185,129,0.1)] text-[#34D399] border border-[rgba(16,185,129,0.2)]">
                <span className="inline-block w-[5px] h-[5px] rounded-full bg-[#10B981]" aria-hidden="true" />
                {low.length} low concern{low.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {emotions.length === 0 ? (
          <div className="rounded-2xl p-5 bg-[#0D1117] border border-[rgba(255,255,255,0.06)]">
            <p className="text-sm text-slate-500">
              Nothing strong enough to flag from this conversation.
            </p>
          </div>
        ) : (
          <section aria-label="Emotion findings" className="space-y-3">
            <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-[#475569]">
              Findings ({emotions.length})
            </p>
            {sorted.map((finding, i) => (
              <EmotionCard key={i} finding={finding} />
            ))}
          </section>
        )}

        <footer className="flex items-center justify-between pt-6 border-t border-t-[rgba(255,255,255,0.06)]">
          <Link href="/" className="text-sm text-[#6366F1] transition-colors">
            ← New check-in
          </Link>
          {process.env.NODE_ENV === 'development' && (
            <details className="text-right">
              <summary className="text-[10px] text-slate-500 cursor-pointer select-none list-none">
                Dev info
              </summary>
              <p className="mt-1 text-[10px] text-slate-500">
                {usage.inputTokens} in / {usage.outputTokens} out &middot; $
                {usage.usdEstimate.toFixed(5)} &middot; {extraction.model}
              </p>
            </details>
          )}
        </footer>

      </div>
    </div>
  );
}
