'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useCallback } from 'react';

import { useSupportStream } from '@/hooks/useSupportStream';
import { getGuestId, getOrCreateSessionId, newSession } from '@/lib/guestSession';
import { type Message, SupportChatMessage } from './SupportChatMessage';

const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const STORAGE_KEY = 'suhail_chat_messages';

export function SupportChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [guestId, setGuestId] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { startStream, stopStream, status } = useSupportStream();
  const isStreaming = status === 'connecting' || status === 'streaming';

  // Restore session and conversation on mount
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
    setGuestId(getGuestId());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        // Clean up any messages left in streaming state
        const cleaned = parsed.map((m) =>
          m.isStreaming
            ? { ...m, isStreaming: false, content: m.streamedText ?? m.content, streamedText: undefined, streamEvents: undefined }
            : m
        );
        setMessages(cleaned);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist messages whenever they change (only when not actively streaming)
  useEffect(() => {
    if (messages.some((m) => m.isStreaming)) return;
    try {
      if (messages.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      }
    } catch { /* storage quota */ }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setInput('');

    const userMsgId = generateId();
    const aiMsgId = generateId();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: text },
      {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        question: text,
        isStreaming: true,
        streamedText: '',
        streamEvents: []
      }
    ]);

    try {
      const result = await startStream(
        { question: text, inquiry_session_id: sessionId, guest_id: guestId },
        {
          onStatus: (label) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, streamEvents: [...(m.streamEvents ?? []), { id: generateId(), label, timestamp: Date.now() }] }
                  : m
              )
            );
          },
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsgId ? { ...m, streamedText: (m.streamedText ?? '') + token } : m))
            );
          }
        }
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
              ...m,
              isStreaming: false,
              content: result.answer,
              streamedText: undefined,
              streamEvents: undefined,
              followUps: result.follow_ups
            }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, isStreaming: false, content: 'Sorry, something went wrong. Please try again.' }
            : m
        )
      );
    }
  }, [sessionId, guestId, startStream, isStreaming, setMessages, setInput, stopStream]);

  const handleRegenerate = useCallback((question: string) => {
    // Remove the last assistant message and re-send the question
    setMessages((prev) => {
      let lastAssistantIdForQuestion: string | undefined;

      for (let index = prev.length - 1; index >= 0; index -= 1) {
        const message = prev[index];
        if (message.role === 'assistant' && message.question === question) {
          lastAssistantIdForQuestion = message.id;
          break;
        }
      }

      return prev.filter(
        (message) =>
          !(
            message.role === 'assistant' &&
            message.question === question &&
            message.id === lastAssistantIdForQuestion
          )
      );
    });
    void sendMessage(question);
  }, [sendMessage, setMessages]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setSessionId(newSession());
    localStorage.removeItem(STORAGE_KEY);
  }, [setMessages, setSessionId]);

  const handleFollowUp = useCallback((question: string) => {
    void sendMessage(question);
  }, [sendMessage]);

  return (
    <div className="flex flex-col h-full bg-[#111217] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shrink-0 overflow-hidden">
            <Image src="/suhail-assets/white_logo.png" alt="Suhail" width={18} height={18} className="object-contain" />
          </div>
          <div>
            <p className="font-sans text-[11px] font-semibold tracking-[0.18em] text-white uppercase leading-none">
              SUH<span className="text-amber-400">AI</span>L
            </p>
            <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Student Advisor</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            New chat
          </button>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-5 flex flex-col gap-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center overflow-hidden">
              <Image src="/suhail-assets/white_logo.png" alt="Suhail" width={44} height={44} className="object-contain" />
            </div>
            <div>
              <p className="font-sans text-base font-semibold tracking-[0.18em] text-white uppercase">
                SUH<span className="text-amber-400">AI</span>L
              </p>
              <p className="text-xs text-zinc-500 mt-1">Your AI Student Advisor</p>
            </div>
            <p className="text-sm text-zinc-400 max-w-[260px] leading-relaxed">
              Ask me anything about courses, graduation requirements, policies, or student life at QU.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <SupportChatMessage
            key={msg.id}
            message={msg}
            onFollowUp={handleFollowUp}
            onRegenerate={handleRegenerate}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 pb-4 pt-2 border-t border-white/8">
        <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-[#0d0e14] px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Ask a question..."
            className="flex-1 resize-none bg-transparent text-sm outline-none text-zinc-100 placeholder:text-zinc-600 max-h-24"
          />
          {isStreaming ? (
            <button onClick={stopStream} className="shrink-0 text-zinc-500 hover:text-red-400 transition-colors pb-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => void sendMessage(input)}
              disabled={!input.trim()}
              className="shrink-0 text-amber-500 disabled:text-zinc-700 hover:text-amber-400 transition-colors pb-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-center text-[10px] text-zinc-700 mt-1.5">Suhail AI · For general guidance only</p>
      </div>
    </div>
  );
}
