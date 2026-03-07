'use client';

import { useEffect, useState } from 'react';

const SC = '!<>-_\\/[]{}—=+*^?#@$%&0123456789ABCDEF';

function scrambleLine(text: string, resolved: number): string {
  return text
    .split('')
    .map((ch, i) => {
      if (ch === ' ' || i < resolved) return ch;
      return SC[Math.floor(Math.random() * SC.length)];
    })
    .join('');
}

interface TerminalProps {
  lines: string[];
  step: number;
  resolved: number;
  cursor: boolean;
  progress: number;
  filled: number;
}

export function HackerTerminal({ lines, step, resolved, cursor, progress, filled }: TerminalProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border bg-card px-6 py-5 font-mono"
      style={{ boxShadow: '0 0 48px rgba(44,173,158,0.12)' }}
    >
      {/* CRT scanlines */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px)',
        }}
      />

      <p className="mb-4 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        CSE Portal — Boot Sequence
      </p>

      <div className="space-y-2">
        {lines.map((line, i) => {
          const isActive = i === step;
          const isDone = i < step;

          let display: string;
          if (isDone) {
            display = line;
          } else if (isActive) {
            display = scrambleLine(line, resolved);
          } else {
            display = line.replace(/[^\s]/g, '·');
          }

          return (
            <p
              key={i}
              className={`text-[13px] leading-relaxed ${
                isDone
                  ? 'text-[hsl(var(--brand-cyan))]'
                  : isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground/20'
              }`}
            >
              {display}
              {isActive && (
                <span
                  aria-hidden="true"
                  className={`ml-0.5 ${cursor ? 'opacity-100' : 'opacity-0'}`}
                >
                  █
                </span>
              )}
            </p>
          );
        })}
      </div>

      <div className="mt-5 text-[11px]">
        <span className="text-muted-foreground">{'['}</span>
        <span className="text-[hsl(var(--brand-cyan))]">{'█'.repeat(filled)}</span>
        <span className="text-muted-foreground/30">{'░'.repeat(20 - filled)}</span>
        <span className="text-muted-foreground">{'] '}</span>
        <span className="text-foreground/50">{progress}%</span>
      </div>
    </div>
  );
}

interface HackerLoaderProps {
  lines: string[];
}

export function HackerLoader({ lines }: HackerLoaderProps) {
  const [step, setStep] = useState(0);
  const [resolved, setResolved] = useState(0);
  const [cursor, setCursor] = useState(true);

  // Cursor blink
  useEffect(() => {
    const t = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(t);
  }, []);

  // Line-by-line reveal
  useEffect(() => {
    if (step >= lines.length) return;
    setResolved(0);
    const lineLen = lines[step].length;

    const t = setInterval(() => {
      setResolved((r) => {
        const next = r + 6;
        if (next >= lineLen) {
          clearInterval(t);
          setTimeout(() => setStep((s) => s + 1), 80);
          return lineLen;
        }
        return next;
      });
    }, 12);

    return () => clearInterval(t);
  }, [step, lines]);

  const lineLen = lines[step]?.length ?? 1;
  const progress = Math.min(
    100,
    Math.round(((step + resolved / lineLen) / lines.length) * 100)
  );
  const filled = Math.round(progress / 5);

  return (
    <main className="content-shell flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-md">
        <HackerTerminal lines={lines} step={step} resolved={resolved} cursor={cursor} progress={progress} filled={filled} />
      </div>
    </main>
  );
}

interface InlineHackerProps {
  lines: string[];
}

export function InlineHacker({ lines }: InlineHackerProps) {
  const [step, setStep] = useState(0);
  const [resolved, setResolved] = useState(0);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (step >= lines.length) return;
    setResolved(0);
    const lineLen = lines[step].length;

    const t = setInterval(() => {
      setResolved((r) => {
        const next = r + 6;
        if (next >= lineLen) {
          clearInterval(t);
          setTimeout(() => setStep((s) => s + 1), 80);
          return lineLen;
        }
        return next;
      });
    }, 12);

    return () => clearInterval(t);
  }, [step, lines]);

  const lineLen = lines[step]?.length ?? 1;
  const progress = Math.min(
    100,
    Math.round(((step + resolved / lineLen) / lines.length) * 100)
  );
  const filled = Math.round(progress / 5);

  return (
    <HackerTerminal
      lines={lines}
      step={step}
      resolved={resolved}
      cursor={cursor}
      progress={progress}
      filled={filled}
    />
  );
}

/** Bare animated scramble lines — no box, no border, renders inline inside any container. */
export function HackerLines({ lines, className }: { lines: string[]; className?: string }) {
  const [step, setStep] = useState(0);
  const [resolved, setResolved] = useState(0);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (step >= lines.length) return;
    setResolved(0);
    const lineLen = lines[step].length;
    const t = setInterval(() => {
      setResolved((r) => {
        const next = r + 6;
        if (next >= lineLen) {
          clearInterval(t);
          setTimeout(() => setStep((s) => s + 1), 80);
          return lineLen;
        }
        return next;
      });
    }, 12);
    return () => clearInterval(t);
  }, [step, lines]);

  return (
    <div className={`font-mono space-y-1.5 ${className ?? ''}`}>
      {lines.map((line, i) => {
        const isActive = i === step;
        const isDone = i < step;
        const display = isDone
          ? line
          : isActive
            ? scrambleLine(line, resolved)
            : line.replace(/[^\s]/g, '·');
        return (
          <p
            key={i}
            className={`text-[13px] leading-relaxed ${
              isDone
                ? 'text-[hsl(var(--brand-cyan))]'
                : isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground/20'
            }`}
          >
            {display}
            {isActive && (
              <span aria-hidden="true" className={`ml-0.5 ${cursor ? 'opacity-100' : 'opacity-0'}`}>
                █
              </span>
            )}
          </p>
        );
      })}
    </div>
  );
}
