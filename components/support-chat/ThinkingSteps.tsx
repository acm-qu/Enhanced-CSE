'use client';

import type { StreamEvent } from '@/hooks/useSupportStream';

export function ThinkingSteps({ events }: { events: StreamEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 px-3 py-2 text-xs text-zinc-500">
      {events.map((e) => (
        <div key={e.id} className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2CAD9E] animate-pulse" />
          {e.label}
        </div>
      ))}
    </div>
  );
}
