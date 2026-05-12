'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MessageList from './MessageList';
import Composer from './Composer';
import EndButton from './EndButton';

export interface ClientMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [assistantTurns, setAssistantTurns] = useState(0);
  const [maxTurns, setMaxTurns] = useState(8);
  const router = useRouter();

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      const userMsg: ClientMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '' },
      ]);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: text }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(err.error ?? 'Request failed');
        }

        const sid = res.headers.get('X-Session-Id');
        if (sid && !sessionId) setSessionId(sid);

        const maxT = res.headers.get('X-Max-Turns');
        if (maxT) setMaxTurns(Number(maxT));

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let content = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content } : m)),
          );
        }

        setAssistantTurns((t) => t + 1);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== assistantId)
            .concat({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: 'Something went wrong. Please try again.',
            }),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId],
  );

  const endConversation = useCallback(async () => {
    if (!sessionId || isEnding) return;
    setIsEnding(true);
    try {
      const res = await fetch('/api/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error('Failed to end conversation');
      router.push(`/result/${sessionId}`);
    } catch {
      setIsEnding(false);
    }
  }, [sessionId, isEnding, router]);

  const atLimit = assistantTurns >= maxTurns;
  const progressPct = Math.min((assistantTurns / maxTurns) * 100, 100);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050709] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(99,102,241,0.06)_0%,transparent_70%)]" />

      <div className="relative w-full max-w-[680px] h-[min(900px,calc(100vh-2rem))] flex flex-col rounded-2xl overflow-hidden bg-[#0D1117] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(99,102,241,0.06)]">

        <header className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-b-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.25)]">
              <span className="text-[10px] font-bold tracking-tight text-[#818CF8]">BC</span>
            </div>
            <span className="text-sm font-semibold text-slate-100">BR-Chat</span>
            <span className="text-slate-700 text-sm" aria-hidden="true">·</span>
            <span className="text-xs text-slate-500">Employee Wellness</span>
          </div>
          <span className="text-[9px] font-semibold text-slate-600 tracking-[0.14em] uppercase rounded-md px-2 py-1 border border-[rgba(255,255,255,0.07)]">
            Confidential
          </span>
        </header>

        <div className="px-5 pt-3 pb-3 shrink-0 border-b border-b-[rgba(255,255,255,0.04)]">
          <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-600">
            <span>Check-in progress</span>
            <span>{assistantTurns} / {maxTurns}</span>
          </div>
          <div className="h-[2px] rounded-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
            <div
              role="progressbar"
              aria-label="Check-in progress"
              aria-valuenow={assistantTurns}
              aria-valuemin={0}
              aria-valuemax={maxTurns}
              className={`h-full rounded-full transition-all duration-700 ${progressPct > 0 ? 'bg-[linear-gradient(90deg,#6366F1,#818CF8)] shadow-[0_0_8px_rgba(99,102,241,0.7)]' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <MessageList messages={messages} isLoading={isLoading} />

        <div className="shrink-0 border-t border-t-[rgba(255,255,255,0.06)]">
          <Composer onSend={sendMessage} disabled={isLoading || atLimit} />
          {sessionId && (
            <div className="px-4 pb-4">
              <EndButton onClick={endConversation} disabled={isEnding} atLimit={atLimit} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
