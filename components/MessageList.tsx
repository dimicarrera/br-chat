'use client';

import { useEffect, useRef } from 'react';
import type { ClientMessage } from './Chat';

interface Props {
  messages: ClientMessage[];
  isLoading: boolean;
}

export default function MessageList({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
        Start by telling me about your day.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-zinc-900 text-white rounded-br-sm'
                : 'bg-zinc-100 text-zinc-800 rounded-bl-sm'
            }`}
          >
            {m.content ||
              (isLoading && m.role === 'assistant' ? (
                <span className="inline-flex gap-1 items-center py-0.5">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : null)}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
