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

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
        <h1 className="text-sm font-medium text-zinc-600">How was your day?</h1>
        {sessionId && <EndButton onClick={endConversation} disabled={isEnding} />}
      </header>

      <MessageList messages={messages} isLoading={isLoading} />

      <Composer onSend={sendMessage} disabled={isLoading || atLimit} />

      {atLimit && (
        <p className="text-center text-xs text-zinc-400 pb-3">
          Conversation complete — click &ldquo;End conversation&rdquo; to see your summary.
        </p>
      )}
    </div>
  );
}
