'use client';

import { useState, useRef, type KeyboardEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function Composer({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const active = Boolean(value.trim()) && !disabled;

  return (
    <div className="px-4 pt-3 pb-3">
      <div className="flex items-end gap-2.5 rounded-xl px-3.5 py-2.5 bg-[#161B27] border border-[rgba(255,255,255,0.07)] focus-within:ring-1 focus-within:ring-[rgba(99,102,241,0.5)] focus-within:border-[rgba(99,102,241,0.4)] transition-shadow">
        <textarea
          ref={textareaRef}
          name="chatinput"
          aria-label="Message"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onInput={onInput}
          disabled={disabled}
          placeholder={disabled ? 'Conversation complete' : 'Share something about your day…'}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-[#E2E8F0] caret-[#6366F1] outline-none leading-relaxed placeholder:text-slate-600 disabled:opacity-40"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className={`flex-shrink-0 w-[30px] h-[30px] flex items-center justify-center rounded-lg transition-all disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161B27] ${
            active
              ? 'bg-[linear-gradient(135deg,#6366F1,#4F46E5)] shadow-[0_0_12px_rgba(99,102,241,0.4)]'
              : 'bg-[rgba(99,102,241,0.15)]'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M6 1L6 11M6 1L2 5M6 1L10 5"
              stroke={active ? '#fff' : '#6366F1'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-0.5">
        <p className="text-[11px] text-slate-400">
          Enter to send <span aria-hidden="true">&middot;</span> Shift+Enter for new line
        </p>
        {value.length > 1800 && (
          <p
            aria-live="polite"
            className={`text-[11px] tabular-nums ${value.length >= 2000 ? 'text-red-400' : 'text-amber-400'}`}
          >
            {value.length}/2000
          </p>
        )}
      </div>
    </div>
  );
}
