'use client';

import Image from 'next/image';
import { useState } from 'react';

import { SupportChatPanel } from './SupportChatPanel';

export function SupportChatBubble() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3">
      {/* Panel */}
      {open && (
        <div className="w-[390px] h-[580px] rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden animate-chat-panel-in">
          <SupportChatPanel onClose={() => setOpen(false)} />
        </div>
      )}

      {/* Bubble button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-900/40 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        aria-label="Open student support chat"
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <Image src="/suhail-assets/white_logo.png" alt="Suhail" width={30} height={30} className="object-contain" />
        )}
      </button>
    </div>
  );
}
