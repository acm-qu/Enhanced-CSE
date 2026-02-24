'use client';

import { useEffect, useRef, useState } from 'react';

import type { TocItem } from '@/lib/utils/content';

export function TocNav({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');
  const navRef = useRef<HTMLElement>(null);

  // Track which heading is in the viewport
  useEffect(() => {
    if (items.length === 0) return;

    const headings = items
      .map(({ id }) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (intersecting.length > 0) {
          setActiveId(intersecting[0].target.id);
        }
      },
      {
        // top offset matches the sticky header; bottom cuts off at 55% so the
        // active item advances before the heading reaches the very bottom
        rootMargin: '-72px 0% -55% 0%',
        threshold: 0,
      }
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  // Scroll the TOC panel so the active link stays visible
  useEffect(() => {
    if (!activeId || !navRef.current) return;
    const link = navRef.current.querySelector<HTMLElement>(`[data-id="${activeId}"]`);
    link?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  return (
    <nav ref={navRef} className="space-y-0.5 border-l border-border/50 pl-3">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          data-id={item.id}
          className={`block py-1 text-sm leading-snug transition-colors ${
            item.level >= 3 ? 'pl-4' : item.level === 2 ? 'pl-2' : ''
          } ${
            activeId === item.id
              ? 'font-medium text-blue-400'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {item.text}
        </a>
      ))}
    </nav>
  );
}
