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

  const { emotions, summary, usage } = extraction;

  return (
    <main className="max-w-2xl mx-auto w-full px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900">Your conversation summary</h1>
        <p className="text-sm text-zinc-600 leading-relaxed">{summary}</p>
      </header>

      {emotions.length === 0 ? (
        <p className="text-sm text-zinc-500 border rounded-xl p-4 bg-zinc-50">
          No negative emotions were clearly identified in this conversation.
        </p>
      ) : (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Emotions identified ({emotions.length})
          </h2>
          {emotions.map((finding, i) => (
            <EmotionCard key={i} finding={finding} />
          ))}
        </section>
      )}

      <footer className="flex items-center justify-between border-t pt-4 text-xs text-zinc-400">
        <span>
          {usage.inputTokens} in / {usage.outputTokens} out &middot; $
          {usage.usdEstimate.toFixed(5)}
        </span>
        <span>{extraction.model}</span>
      </footer>

      <Link
        href="/"
        className="inline-block text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        ← Start a new conversation
      </Link>
    </main>
  );
}
