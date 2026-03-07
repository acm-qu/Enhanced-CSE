'use client';

import { useState } from 'react';

import { SupportChatPanel } from './SupportChatPanel';

export function SupportChatBubble() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-[60] flex flex-col items-start gap-3 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end">
      {open ? (
        <div className="h-[min(580px,calc(100vh-5rem))] w-[min(390px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl animate-chat-panel-in">
          <SupportChatPanel onClose={() => setOpen(false)} />
        </div>
      ) : null}

      <button
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 shadow-lg shadow-amber-900/40 transition-all duration-200 hover:scale-105 hover:bg-amber-400 active:scale-95 sm:h-14 sm:w-14"
        aria-label="Open student support chat"
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <img src="/suhail-assets/white_logo.png" alt="Suhail" width={24} height={24} className="h-auto w-auto object-contain sm:h-[30px] sm:w-[30px]" />
        )}
      </button>
    </div>
  );
}