'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Connection, CourseData, StudyPlanTerm } from '@/app/cs-study-plan/page';

// â”€â”€â”€ Internal types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Color helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Position util â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Course ID display â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function displayCourseId(id: string): string | null {
  if (id.includes(' ')) return id;
  const m = id.match(/ELECTIVE_([IVX]+)$/);
  if (m) return `Elective ${m[1]}`;
  return null; // packages â€” hide internal ID
}

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        <p className="text-zinc-600 text-[10px] mt-0.5">{course.schedule_types.join(' Â· ')}</p>
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

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function StudyPlanBoard({ terms, courses, connections }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [arrows, setArrows] = useState<ComputedArrow[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ id: string; x: number; y: number } | null>(null);

  const courseTermIdx = useMemo(() => {
    const map: Record<string, number> = {};
    terms.forEach((term, index) => {
      term.courses.forEach((id) => {
        map[id] = index;
      });
    });
    return map;
  }, [terms]);

  useEffect(() => {
    const compute = () => {
      const content = contentRef.current;
      if (!content) {
        return;
      }

      setSvgSize({ w: content.scrollWidth, h: content.scrollHeight });
      const nextArrows: ComputedArrow[] = [];

      for (const connection of connections) {
        const fromElement = cardRefs.current.get(connection.from);
        const toElement = cardRefs.current.get(connection.to);
        if (!fromElement || !toElement) {
          continue;
        }

        const from = offsetFrom(fromElement, content);
        const to = offsetFrom(toElement, content);
        const sameCol = courseTermIdx[connection.from] === courseTermIdx[connection.to];

        nextArrows.push({
          ...connection,
          sx: from.x + from.w,
          sy: from.y + from.h / 2,
          tx: sameCol ? to.x + to.w : to.x,
          ty: to.y + to.h / 2,
          sameCol,
        });
      }

      setArrows(nextArrows);
    };

    const frameId = requestAnimationFrame(() => {
      compute();
    });
    const resizeObserver = new ResizeObserver(compute);

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener('resize', compute);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [connections, courseTermIdx]);

  const years = [1, 2, 3, 4].map((year) => ({
    year,
    fall: terms.find((term) => term.year === year && term.term === 'Fall')!,
    spring: terms.find((term) => term.year === year && term.term === 'Spring')!,
  }));

  const relatedIds = useMemo(() => {
    if (!hovered) {
      return new Set<string>();
    }

    return new Set(
      connections.flatMap((connection) =>
        connection.from === hovered || connection.to === hovered ? [connection.from, connection.to] : []
      )
    );
  }, [hovered, connections]);

  return (
    <div className="px-4 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950">
        <div className="w-full overflow-x-auto overflow-y-hidden">
          <div className="relative min-w-full">
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

                {arrows.map((arrow, index) => {
                  const isRelated = hovered ? arrow.from === hovered || arrow.to === hovered : true;
                  const opacity = hovered ? (isRelated ? 0.9 : 0.04) : 0.1;
                  const stroke = arrow.type === 'prereq' ? '#ef4444' : '#60a5fa';
                  const marker = arrow.type === 'prereq' ? 'url(#arh-pre)' : 'url(#arh-con)';

                  let path: string;
                  if (arrow.sameCol) {
                    const bend = 46;
                    path = `M${arrow.sx} ${arrow.sy} C${arrow.sx + bend} ${arrow.sy},${arrow.tx + bend} ${arrow.ty},${arrow.tx} ${arrow.ty}`;
                  } else {
                    const deltaX = Math.max(48, Math.abs(arrow.tx - arrow.sx) * 0.42);
                    path = `M${arrow.sx} ${arrow.sy} C${arrow.sx + deltaX} ${arrow.sy},${arrow.tx - deltaX} ${arrow.ty},${arrow.tx} ${arrow.ty}`;
                  }

                  return (
                    <path
                      key={index}
                      d={path}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeDasharray={arrow.type === 'concurrent' ? '5 3' : undefined}
                      markerEnd={marker}
                      opacity={opacity}
                      style={{ transition: 'opacity 0.12s' }}
                    />
                  );
                })}
              </svg>
            )}

            <div className="relative flex w-full flex-row gap-6 px-6 py-6 pb-4" ref={contentRef}>
              {years.map(({ year, fall, spring }) => (
                <div key={year} className="flex min-w-0 flex-1 flex-col" style={{ position: 'relative', zIndex: 10 }}>
                  <div className="mb-4 flex justify-center">
                    <span className="rounded-full border border-zinc-700/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Year {year}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-row gap-3">
                    {[fall, spring].map((term) => (
                      <div key={term.term} className="flex min-w-0 flex-1 flex-col">
                        <div className="mb-3 border-b border-zinc-800 pb-2 text-center">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">{term.term}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">{term.total_credit_hours} credit hrs</p>
                        </div>

                        <div className="flex flex-col gap-2.5">
                          {term.courses.map((courseId) => {
                            const course = courses[courseId];
                            if (!course) {
                              return null;
                            }

                            const colors = getColors(courseId, course.type);
                            const isHovered = hovered === courseId;
                            const isRelated = relatedIds.has(courseId);
                            const isDimmed = !!hovered && !isHovered && !isRelated;

                            const isPackage = course.type === 'package' || courseId.endsWith('_PKG');
                            const url = course.sources?.mybanner_url
                              ?? (isPackage ? 'https://www.qu.edu.qa/en-us/core/student-information/Pages/packages.aspx' : undefined);
                            const cardClassName = [
                              'rounded-lg border px-3 py-2.5 transition-all duration-150',
                              url ? 'cursor-pointer' : 'cursor-default',
                              'select-none',
                              colors.card,
                              isHovered ? 'scale-[1.04] ring-2 ring-white/20 shadow-lg shadow-black/40' : '',
                              isDimmed ? 'opacity-25' : 'opacity-100',
                            ].join(' ');
                            const cardStyle = { position: 'relative' as const, zIndex: isHovered ? 30 : 15 };
                            const cardHandlers = {
                              onMouseEnter: (event: React.MouseEvent) => {
                                setHovered(courseId);
                                setTooltip({ id: courseId, x: event.clientX, y: event.clientY });
                              },
                              onMouseMove: (event: React.MouseEvent) => {
                                setTooltip((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : null));
                              },
                              onMouseLeave: () => {
                                setHovered(null);
                                setTooltip(null);
                              },
                            };
                            const cardInner = (
                              <>
                                <div className="mb-1 flex items-start justify-between gap-1">
                                  {displayCourseId(courseId) !== null && (
                                    <span className={`font-mono text-xs font-bold leading-none ${colors.cid}`}>{displayCourseId(courseId)}</span>
                                  )}
                                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${colors.badge}`}>
                                    {course.credit_hours}CH
                                  </span>
                                </div>
                                <p className={`text-[11px] leading-snug ${colors.title}`}>{course.title}</p>
                              </>
                            );

                            return url ? (
                              <Link
                                key={courseId}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                ref={(element) => {
                                  if (element) {
                                    cardRefs.current.set(courseId, element as unknown as HTMLDivElement);
                                  } else {
                                    cardRefs.current.delete(courseId);
                                  }
                                }}
                                className={cardClassName}
                                style={cardStyle}
                                {...cardHandlers}
                              >
                                {cardInner}
                              </Link>
                            ) : (
                              <div
                                key={courseId}
                                ref={(element) => {
                                  if (element) {
                                    cardRefs.current.set(courseId, element);
                                  } else {
                                    cardRefs.current.delete(courseId);
                                  }
                                }}
                                className={cardClassName}
                                style={cardStyle}
                                {...cardHandlers}
                              >
                                {cardInner}
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
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.06] px-6 py-4 text-[11px] text-zinc-400">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Legend</span>
          <LegendArrow type="prereq" label="Prerequisite" />
          <LegendArrow type="concurrent" label="Concurrent prereq" />
          <LegendSwatch cls="border-blue-700 bg-blue-900" label="CS Core" />
          <LegendSwatch cls="border-emerald-700 bg-emerald-900" label="Math / Science" />
          <LegendSwatch cls="border-teal-700 bg-teal-900" label="Engineering" />
          <LegendSwatch cls="border-amber-700 bg-amber-900" label="Languages / Humanities" />
          <LegendSwatch cls="border-rose-700 bg-rose-900" label="Major Elective" />
          <LegendSwatch cls="border-dashed border-zinc-600 bg-zinc-800" label="Package" />
        </div>
      </div>

      {tooltip && courses[tooltip.id] && (
        <CourseTooltip courseId={tooltip.id} course={courses[tooltip.id]} x={tooltip.x} y={tooltip.y} />
      )}
    </div>
  );
}
