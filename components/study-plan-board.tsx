'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Connection, CourseData, StudyPlanTerm } from '@/app/cs-study-plan/page';

// ─── Internal types ───────────────────────────────────────────────────────────
interface ComputedArrow extends Connection {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sameCol: boolean;
}

interface Props {
  terms: StudyPlanTerm[];
  courses: Record<string, CourseData>;
  connections: Connection[];
}

// ─── Color helpers ────────────────────────────────────────────────────────────
type ColorSet = { card: string; badge: string; cid: string; title: string };

function getColors(id: string, type?: string): ColorSet {
  if (id.includes('ELECTIVE'))
    return { card: 'bg-rose-950/50 border-rose-700', badge: 'bg-rose-800/50 text-rose-300', cid: 'text-rose-300', title: 'text-rose-200/80' };
  if (type === 'package' || id.endsWith('_PKG'))
    return { card: 'bg-zinc-800/50 border-dashed border-zinc-600/70', badge: 'bg-zinc-700/50 text-zinc-400', cid: 'text-zinc-400', title: 'text-zinc-300/80' };

  const prefix = id.split(' ')[0];
  const map: Record<string, ColorSet> = {
    CMPS: { card: 'bg-blue-950/60 border-blue-700/80', badge: 'bg-blue-900/60 text-blue-300', cid: 'text-blue-300', title: 'text-blue-100/80' },
    CMPE: { card: 'bg-blue-950/60 border-blue-700/80', badge: 'bg-blue-900/60 text-blue-300', cid: 'text-blue-300', title: 'text-blue-100/80' },
    MATH: { card: 'bg-emerald-950/60 border-emerald-700/80', badge: 'bg-emerald-900/60 text-emerald-300', cid: 'text-emerald-300', title: 'text-emerald-100/80' },
    PHYS: { card: 'bg-emerald-950/60 border-emerald-700/80', badge: 'bg-emerald-900/60 text-emerald-300', cid: 'text-emerald-300', title: 'text-emerald-100/80' },
    CHEM: { card: 'bg-emerald-950/60 border-emerald-700/80', badge: 'bg-emerald-900/60 text-emerald-300', cid: 'text-emerald-300', title: 'text-emerald-100/80' },
    GENG: { card: 'bg-teal-950/50 border-teal-700/70', badge: 'bg-teal-900/50 text-teal-300', cid: 'text-teal-300', title: 'text-teal-100/80' },
    ENGL: { card: 'bg-amber-950/50 border-amber-700/70', badge: 'bg-amber-900/50 text-amber-300', cid: 'text-amber-300', title: 'text-amber-100/80' },
    ARAB: { card: 'bg-amber-950/50 border-amber-700/70', badge: 'bg-amber-900/50 text-amber-300', cid: 'text-amber-300', title: 'text-amber-100/80' },
    HIST: { card: 'bg-amber-950/50 border-amber-700/70', badge: 'bg-amber-900/50 text-amber-300', cid: 'text-amber-300', title: 'text-amber-100/80' },
    DAWA: { card: 'bg-amber-950/50 border-amber-700/70', badge: 'bg-amber-900/50 text-amber-300', cid: 'text-amber-300', title: 'text-amber-100/80' },
    MAGT: { card: 'bg-zinc-800/60 border-zinc-600/70', badge: 'bg-zinc-700/50 text-zinc-300', cid: 'text-zinc-300', title: 'text-zinc-200/80' },
  };
  return map[prefix] ?? { card: 'bg-zinc-800/50 border-zinc-600/70', badge: 'bg-zinc-700/50 text-zinc-400', cid: 'text-zinc-300', title: 'text-zinc-200/80' };
}

// ─── Position util ────────────────────────────────────────────────────────────
function offsetFrom(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0, y = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== ancestor) {
    x += cur.offsetLeft;
    y += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function LegendArrow({ type, label }: { type: 'prereq' | 'concurrent'; label: string }) {
  const color = type === 'prereq' ? '#ef4444' : '#60a5fa';
  const mid = `leg-${type}`;
  return (
    <span className="flex items-center gap-1.5">
      <svg width="26" height="10" className="shrink-0">
        <defs>
          <marker id={mid} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0L8 4L0 8Z" fill={color} />
          </marker>
        </defs>
        <line x1="0" y1="5" x2="18" y2="5" stroke={color} strokeWidth="1.5"
          strokeDasharray={type === 'concurrent' ? '4 3' : undefined}
          markerEnd={`url(#${mid})`} />
      </svg>
      {label}
    </span>
  );
}

function LegendSwatch({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm border inline-block shrink-0 ${cls}`} />
      {label}
    </span>
  );
}

function CourseTooltip({ courseId, course, x, y }: { courseId: string; course: CourseData; x: number; y: number }) {
  const prereqText = course.requisites?.prerequisites?.text;
  const coreqText = course.requisites?.corequisites?.text;
  const safeX = Math.min(x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 272);
  const safeY = Math.min(y + 14, (typeof window !== 'undefined' ? window.innerHeight : 800) - 220);
  return (
    <div
      style={{ position: 'fixed', left: safeX, top: safeY, zIndex: 9999 }}
      className="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl p-3 w-64 pointer-events-none"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono font-bold text-white text-[11px] leading-tight">{courseId}</p>
        <span className="text-[10px] text-zinc-400 shrink-0">{course.credit_hours} CH</span>
      </div>
      <p className="text-zinc-200 text-[11px] mt-0.5 leading-snug">{course.title}</p>
      {course.department && <p className="text-zinc-500 text-[10px] mt-1 leading-snug">{course.department}</p>}
      {course.schedule_types && course.schedule_types.length > 0 && (
        <p className="text-zinc-600 text-[10px] mt-0.5">{course.schedule_types.join(' · ')}</p>
      )}
      {prereqText && (
        <div className="mt-2 pt-1.5 border-t border-zinc-700/50">
          <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">Prerequisites</p>
          <p className="text-zinc-300 text-[10px] leading-snug">{prereqText}</p>
        </div>
      )}
      {coreqText && (
        <div className="mt-1.5">
          <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">Corequisites</p>
          <p className="text-zinc-300 text-[10px] leading-snug">{coreqText}</p>
        </div>
      )}
      {course.program_policy_overrides?.map((note, i) => (
        <p key={i} className="text-amber-400 text-[10px] mt-1.5 leading-snug border-t border-zinc-700/50 pt-1.5">{note}</p>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function StudyPlanBoard({ terms, courses, connections }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [arrows, setArrows] = useState<ComputedArrow[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ id: string; x: number; y: number } | null>(null);

  const courseTermIdx = useMemo(() => {
    const m: Record<string, number> = {};
    terms.forEach((t, i) => t.courses.forEach((id) => { m[id] = i; }));
    return m;
  }, [terms]);

  useEffect(() => {
    const compute = () => {
      const board = boardRef.current;
      if (!board) return;
      setSvgSize({ w: board.scrollWidth, h: board.scrollHeight });
      const out: ComputedArrow[] = [];
      for (const conn of connections) {
        const fEl = cardRefs.current.get(conn.from);
        const tEl = cardRefs.current.get(conn.to);
        if (!fEl || !tEl) continue;
        const f = offsetFrom(fEl, board);
        const t = offsetFrom(tEl, board);
        const sameCol = courseTermIdx[conn.from] === courseTermIdx[conn.to];
        out.push({
          ...conn,
          sx: f.x + f.w,
          sy: f.y + f.h / 2,
          tx: sameCol ? t.x + t.w : t.x,
          ty: t.y + t.h / 2,
          sameCol,
        });
      }
      setArrows(out);
    };

    // Delay slightly to ensure all card refs are populated after first paint
    const id = requestAnimationFrame(() => { compute(); });
    const ro = new ResizeObserver(compute);
    if (boardRef.current) ro.observe(boardRef.current);
    window.addEventListener('resize', compute);
    return () => { cancelAnimationFrame(id); ro.disconnect(); window.removeEventListener('resize', compute); };
  }, [connections, courseTermIdx]);

  const years = [1, 2, 3, 4].map((y) => ({
    year: y,
    fall: terms.find((t) => t.year === y && t.term === 'Fall')!,
    spring: terms.find((t) => t.year === y && t.term === 'Spring')!,
  }));

  const relatedIds = useMemo(() => {
    if (!hovered) return new Set<string>();
    return new Set(connections.flatMap((c) =>
      c.from === hovered || c.to === hovered ? [c.from, c.to] : []
    ));
  }, [hovered, connections]);

  return (
    <div className="px-4 sm:px-6">
      {/* Scrollable board */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="relative inline-flex flex-row gap-10 px-6 py-6 pb-20" ref={boardRef}>

          {/* SVG overlay — covers full content area */}
          {svgSize.w > 0 && (
            <svg
              style={{ position: 'absolute', top: 0, left: 0, width: svgSize.w, height: svgSize.h, pointerEvents: 'none', zIndex: 5 }}
              aria-hidden="true"
            >
              <defs>
                <marker id="arh-pre" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M0 0L8 4L0 8Z" fill="#ef4444cc" />
                </marker>
                <marker id="arh-con" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M0 0L8 4L0 8Z" fill="#60a5facc" />
                </marker>
              </defs>

              {arrows.map((ar, i) => {
                const isRel = hovered ? (ar.from === hovered || ar.to === hovered) : true;
                const op = hovered ? (isRel ? 0.9 : 0.04) : 0.1;
                const stroke = ar.type === 'prereq' ? '#ef4444' : '#60a5fa';
                const marker = ar.type === 'prereq' ? 'url(#arh-pre)' : 'url(#arh-con)';
                let d: string;
                if (ar.sameCol) {
                  // C-curve to the right for same-column (concurrent)
                  const b = 46;
                  d = `M${ar.sx} ${ar.sy} C${ar.sx + b} ${ar.sy},${ar.tx + b} ${ar.ty},${ar.tx} ${ar.ty}`;
                } else {
                  const dx = Math.max(48, Math.abs(ar.tx - ar.sx) * 0.42);
                  d = `M${ar.sx} ${ar.sy} C${ar.sx + dx} ${ar.sy},${ar.tx - dx} ${ar.ty},${ar.tx} ${ar.ty}`;
                }
                return (
                  <path
                    key={i} d={d} fill="none"
                    stroke={stroke} strokeWidth={1.5}
                    strokeDasharray={ar.type === 'concurrent' ? '5 3' : undefined}
                    markerEnd={marker}
                    opacity={op}
                    style={{ transition: 'opacity 0.12s' }}
                  />
                );
              })}
            </svg>
          )}

          {/* Year groups */}
          {years.map(({ year, fall, spring }) => (
            <div key={year} className="flex flex-col" style={{ position: 'relative', zIndex: 10 }}>
              {/* Year pill header */}
              <div className="flex justify-center mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/40 px-3 py-1 rounded-full border border-border/40">
                  Year {year}
                </span>
              </div>

              {/* Fall + Spring columns */}
              <div className="flex flex-row gap-4">
                {[fall, spring].map((term) => (
                  <div key={term.term} className="flex flex-col w-[172px]">
                    {/* Semester label */}
                    <div className="text-center mb-3 pb-2 border-b border-border/30">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/60">{term.term}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{term.total_credit_hours} credit hrs</p>
                    </div>

                    {/* Course cards */}
                    <div className="flex flex-col gap-2.5">
                      {term.courses.map((cid) => {
                        const course = courses[cid];
                        if (!course) return null;
                        const col = getColors(cid, course.type);
                        const isHov = hovered === cid;
                        const isRel = relatedIds.has(cid);
                        const dimmed = !!hovered && !isHov && !isRel;

                        return (
                          <div
                            key={cid}
                            ref={(el) => { if (el) cardRefs.current.set(cid, el); else cardRefs.current.delete(cid); }}
                            onMouseEnter={(e) => { setHovered(cid); setTooltip({ id: cid, x: e.clientX, y: e.clientY }); }}
                            onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => { setHovered(null); setTooltip(null); }}
                            className={[
                              'rounded-lg border px-2.5 py-2 cursor-default select-none',
                              'transition-all duration-150',
                              col.card,
                              isHov ? 'ring-2 ring-white/20 shadow-lg shadow-black/40 scale-[1.04]' : '',
                              dimmed ? 'opacity-25' : 'opacity-100',
                            ].join(' ')}
                            style={{ position: 'relative', zIndex: isHov ? 30 : 15 }}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className={`text-[10px] font-bold font-mono leading-none ${col.cid}`}>{cid}</span>
                              <span className={`text-[9px] rounded px-1 py-0.5 font-semibold shrink-0 leading-tight ${col.badge}`}>
                                {course.credit_hours}CH
                              </span>
                            </div>
                            <p className={`text-[10px] leading-snug ${col.title}`}>{course.title}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 pb-4 text-[11px] text-muted-foreground">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/30">Legend</span>
        <LegendArrow type="prereq" label="Prerequisite" />
        <LegendArrow type="concurrent" label="Concurrent prereq" />
        <LegendSwatch cls="bg-blue-900 border-blue-700" label="CS Core" />
        <LegendSwatch cls="bg-emerald-900 border-emerald-700" label="Math / Science" />
        <LegendSwatch cls="bg-teal-900 border-teal-700" label="Engineering" />
        <LegendSwatch cls="bg-amber-900 border-amber-700" label="Languages / Humanities" />
        <LegendSwatch cls="bg-rose-900 border-rose-700" label="Major Elective" />
        <LegendSwatch cls="bg-zinc-800 border-dashed border-zinc-600" label="Package" />
      </div>

      {/* Tooltip */}
      {tooltip && courses[tooltip.id] && (
        <CourseTooltip courseId={tooltip.id} course={courses[tooltip.id]} x={tooltip.x} y={tooltip.y} />
      )}
    </div>
  );
}
