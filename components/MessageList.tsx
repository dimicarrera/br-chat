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
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.2)]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#818CF8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-slate-400">How was your day?</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            This is a confidential check-in. Share as much or as little as you&apos;d like.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div role="log" aria-label="Conversation" className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {m.role === 'assistant' && (
            <div aria-hidden="true" className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-[#818CF8] bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.2)] shrink-0 mt-1">
              AI
            </div>
          )}
          <div
            className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-[linear-gradient(135deg,#6366F1,#4F46E5)] text-white rounded-br-[4px]'
                : 'bg-[#161B27] text-slate-300 rounded-bl-[4px] border border-[rgba(255,255,255,0.05)]'
            }`}
          >
            {m.content ||
              (isLoading && m.role === 'assistant' ? (
                <span role="status" aria-label="Assistant is typing" className="inline-flex gap-1 items-center py-0.5">
                  <span aria-hidden="true" className="w-[5px] h-[5px] bg-[#4B5563] rounded-full animate-bounce [animation-delay:0ms]" />
                  <span aria-hidden="true" className="w-[5px] h-[5px] bg-[#4B5563] rounded-full animate-bounce [animation-delay:150ms]" />
                  <span aria-hidden="true" className="w-[5px] h-[5px] bg-[#4B5563] rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : null)}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
