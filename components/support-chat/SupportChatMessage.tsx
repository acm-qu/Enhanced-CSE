'use client';

import Image from 'next/image';
import { useState } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  question?: string; // the user question that prompted this assistant message
  isStreaming?: boolean;
  streamedText?: string;
  streamEvents?: { id: string; label: string; timestamp: number }[];
  followUps?: string[];
}

interface Props {
  message: Message;
  onFollowUp: (text: string) => void;
  onRegenerate?: (question: string) => void;
}

function extractAnswer(raw: string): { text: string; extractedFollowUps?: string[] } {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('{')) return { text: raw };
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.answer === 'string') {
      return {
        text: parsed.answer,
        extractedFollowUps: Array.isArray(parsed.follow_ups) ? (parsed.follow_ups as string[]) : undefined
      };
    }
  } catch {
    /* not JSON */
  }
  return { text: raw };
}

function MessageText({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="flex flex-col gap-2">
      {paragraphs.map((para, i) => (
        <p key={i} className="leading-relaxed">
          {para.split('\n').map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export function SupportChatMessage({ message, onFollowUp, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';
  const rawText = message.isStreaming ? (message.streamedText ?? '') : message.content;

  const { text: displayText, extractedFollowUps } =
    isAssistant && !message.isStreaming ? extractAnswer(rawText) : { text: rawText };

  const followUps = message.followUps?.length ? message.followUps : (extractedFollowUps ?? []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  /* ── User message ── */
  if (!isAssistant) {
    return (
      <div className="flex justify-end px-4 animate-chat-msg-in">
        <div className="max-w-[78%] rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm text-white whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  const recentEvents = message.streamEvents?.slice(-3) ?? [];
  const latestEvent = recentEvents[recentEvents.length - 1];

  /* ── Assistant message ── */
  return (
    <div className="flex flex-col gap-1 px-4 animate-chat-msg-in">
      {/* Avatar + name */}
      <div className="flex items-center gap-2 mb-0.5">
        <div className={`w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 overflow-hidden transition-shadow duration-300 ${message.isStreaming ? 'shadow-[0_0_0_3px_rgba(245,158,11,0.25)] animate-pulse' : ''}`}>
          <Image src="/suhail-assets/white_logo.png" alt="Suhail" width={22} height={22} className="object-contain" />
        </div>
        <span className="font-sans text-[11px] font-semibold tracking-[0.18em] text-white uppercase">
          SUH<span className="text-amber-400">AI</span>L
        </span>
      </div>

      {/* Thinking steps — show only while streaming, latest highlighted */}
      {message.isStreaming && recentEvents.length > 0 && (
        <div className="pl-10 flex flex-col gap-0.5 mb-1">
          {recentEvents.map((e) => {
            const isLatest = e.id === latestEvent?.id;
            return (
              <div
                key={e.id}
                className={`flex items-center gap-2 text-xs transition-all duration-300 ${isLatest ? 'text-amber-400/90 opacity-100' : 'text-zinc-600 opacity-40'}`}
              >
                <span className={`h-1 w-1 rounded-full shrink-0 ${isLatest ? 'bg-amber-400 animate-pulse' : 'bg-zinc-700'}`} />
                {e.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Message text — no bubble */}
      <div className="pl-10 text-sm text-zinc-100 leading-relaxed">
        {displayText ? (
          <>
            <MessageText text={displayText} />
            {message.isStreaming && (
              <span className="inline-block w-0.5 h-[1.1em] bg-amber-400/70 ml-0.5 animate-pulse align-middle" />
            )}
          </>
        ) : message.isStreaming ? (
          <span className="flex gap-2 items-center pt-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500/60 animate-thinking-dot [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-amber-500/60 animate-thinking-dot [animation-delay:160ms]" />
            <span className="w-2 h-2 rounded-full bg-amber-500/60 animate-thinking-dot [animation-delay:320ms]" />
          </span>
        ) : null}
      </div>

      {/* Copy + Regenerate actions */}
      {!message.isStreaming && displayText && (
        <div className="pl-10 flex items-center gap-3 mt-0.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>

          {onRegenerate && message.question && (
            <button
              onClick={() => onRegenerate(message.question!)}
              className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </button>
          )}
        </div>
      )}

      {/* Follow-up suggestions */}
      {!message.isStreaming && followUps.length > 0 && (
        <div className="pl-10 flex flex-col mt-2">
          {followUps.slice(0, 3).map((q, i) => (
            <button
              key={i}
              onClick={() => onFollowUp(q)}
              className="flex items-center gap-2.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/70 py-2 px-2 rounded-lg transition-colors text-left"
            >
              <svg className="w-3.5 h-3.5 shrink-0 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
              <span className="leading-snug">{q.length > 90 ? q.slice(0, 87) + '…' : q}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
