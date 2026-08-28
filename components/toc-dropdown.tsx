'use client';

import { useMemo, useState } from 'react';
import { ChevronDownIcon, ListTreeIcon, SearchIcon } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TocItem } from '@/lib/utils/content';

// Below this many entries the list fits on screen and a filter box is just noise.
const FILTER_THRESHOLD = 8;

interface TocDropdownProps {
  items: TocItem[];
  /** Small caps line on the trigger, e.g. "Jump to project". */
  eyebrow: string;
  /** Counted noun for the trigger and the filter placeholder, e.g. "project". */
  noun: string;
  className?: string;
}

/**
 * In-page navigation for viewports below `xl`, where the sticky TOC sidebar is
 * hidden. The senior-project archives run to 60+ headings, so this carries a
 * filter box rather than only a list.
 *
 * The panel floats in a portal instead of expanding in flow: an in-flow panel
 * collapsing on click shifts everything below it while the browser is still
 * resolving the anchor jump, which lands you at the wrong offset.
 */
export function TocDropdown({ items, eyebrow, noun, className }: TocDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Numbered off the full list so positions stay stable while filtering.
  const numbered = useMemo(() => items.map((item, index) => ({ ...item, position: index + 1 })), [items]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return numbered;
    }
    return numbered.filter((item) => item.text.toLowerCase().includes(needle));
  }, [numbered, query]);

  if (items.length === 0) {
    return null;
  }

  const showFilter = items.length > FILTER_THRESHOLD;
  const countLabel = `${items.length} ${noun}${items.length === 1 ? '' : 's'}`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${eyebrow} — ${countLabel}`}
          className={cn(
            'group flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card/60 px-3.5 py-2.5 text-left backdrop-blur',
            'shadow-[0_10px_24px_rgba(0,0,0,0.04)] transition-colors',
            'hover:border-[hsl(var(--brand-cyan))]/45 hover:bg-card',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-cyan))]/40',
            open && 'border-[hsl(var(--brand-cyan))]/55 bg-card',
            className
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--brand-cyan))]/15 text-[hsl(var(--brand-cyan))]">
            <ListTreeIcon className="h-3.5 w-3.5" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
              {eyebrow}
            </span>
            <span className="block truncate text-sm font-medium text-foreground">{countLabel}</span>
          </span>

          <ChevronDownIcon
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        // Radix returns focus to the trigger on close, and focusing an element
        // scrolls it into view — which would drag the page straight back up
        // from the heading we just jumped to.
        onCloseAutoFocus={(event) => event.preventDefault()}
        // Autofocusing the filter opens the on-screen keyboard over the list on
        // phones, which is where this control is used most.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={cn(
          'w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border-border/70 p-0',
          'bg-popover/95 shadow-[0_24px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl'
        )}
      >
        {showFilter ? (
          <div className="border-b border-border/60 p-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Filter ${noun}s...`}
                aria-label={`Filter ${noun}s`}
                className={cn(
                  'h-9 w-full rounded-lg border border-border/60 bg-background/70 pl-8 pr-3 text-sm text-foreground outline-none',
                  'placeholder:text-muted-foreground/70',
                  'focus:border-[hsl(var(--brand-cyan))]/50 focus:ring-1 focus:ring-[hsl(var(--brand-cyan))]/30'
                )}
              />
            </div>
          </div>
        ) : null}

        <div className="no-scrollbar max-h-[min(60vh,24rem)] overflow-y-auto overscroll-contain py-1">
          {matches.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            matches.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-start gap-2.5 px-3 py-2 text-sm leading-snug text-foreground/80 transition-colors',
                  'hover:bg-[hsl(var(--brand-cyan))]/10 hover:text-foreground',
                  'focus-visible:bg-[hsl(var(--brand-cyan))]/10 focus-visible:text-foreground focus-visible:outline-none',
                  item.level >= 3 && 'pl-8'
                )}
              >
                <span className="mt-px w-5 shrink-0 text-right font-mono text-[10px] tabular-nums leading-5 text-muted-foreground/55">
                  {item.position}
                </span>
                <span className="min-w-0 flex-1">{item.text}</span>
              </a>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
