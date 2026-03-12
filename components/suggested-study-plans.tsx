'use client';

import { useMemo, useState } from 'react';

import type { Connection, CourseData, StudyPlanTerm } from '@/app/cs-study-plan/page';
import { StudyPlanBoard } from '@/components/study-plan-board';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ParsedReqItem = string | { all_of?: ParsedReqItem[]; any_of?: ParsedReqItem[] };
type ParsedReq = { all_of?: ParsedReqItem[]; any_of?: ParsedReqItem[] };

function extractIds(parsed: ParsedReq | null | undefined): string[] {
  if (!parsed) return [];
  const ids: string[] = [];
  const walk = (item: ParsedReqItem) => {
    if (typeof item === 'string') { ids.push(item); return; }
    item.all_of?.forEach(walk);
    item.any_of?.forEach(walk);
  };
  parsed.all_of?.forEach(walk);
  parsed.any_of?.forEach(walk);
  return ids;
}

interface ProposedStudyPlan {
  id: string;
  title: string;
  proposerName: string;
  proposerStatus: string;
  proposerLinkedIn: string;
  planSource: StudyPlanTerm[];
  major: string;
  why: string[];
  closing?: string;
}

interface ProposedStudyPlansResponse {
  plans: ProposedStudyPlan[];
}

interface SuggestedStudyPlansProps {
  terms: StudyPlanTerm[];
  courses: Record<string, CourseData>;
  connections: Connection[];
}

export function SuggestedStudyPlans({ terms, courses, connections }: SuggestedStudyPlansProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [plans, setPlans] = useState<ProposedStudyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );

  const { planTerms, planConnections } = useMemo(() => {
    if (!selectedPlan) return { planTerms: terms, planConnections: connections };
    const planIds = new Set(selectedPlan.planSource.flatMap((t) => t.courses));
    const seen = new Set<string>();
    const planConnections: Connection[] = [];
    for (const [id, course] of Object.entries(courses)) {
      if (!planIds.has(id)) continue;
      for (const fromId of extractIds(course.requisites?.prerequisites?.parsed as ParsedReq | null)) {
        if (!planIds.has(fromId)) continue;
        const key = `pre:${fromId}->${id}`;
        if (!seen.has(key)) { seen.add(key); planConnections.push({ from: fromId, to: id, type: 'prereq' }); }
      }
      for (const fromId of (course.requisites?.concurrent_prerequisites_from_roadmap ?? [])) {
        if (!planIds.has(fromId)) continue;
        const key = `con:${fromId}->${id}`;
        if (!seen.has(key)) { seen.add(key); planConnections.push({ from: fromId, to: id, type: 'concurrent' }); }
      }
    }
    return { planTerms: selectedPlan.planSource, planConnections };
  }, [selectedPlan, courses, terms, connections]);

  const togglePlans = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (!nextOpen || plans.length > 0 || isLoading) {
      return;
    }

    try {
      setIsLoading(true);
      setLoadError(null);

      const response = await fetch('/New%20folder/proposed-study-plans.json', {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch plans (${response.status})`);
      }

      const payload = (await response.json()) as ProposedStudyPlansResponse;
      setPlans(payload.plans ?? []);
    } catch {
      setLoadError('Unable to load suggested plans right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openPlanModal = (planId: string) => {
    setSelectedPlanId(planId);
    setIsModalOpen(true);
  };

  return (
    <>
      <section className="px-4 pt-6 sm:px-6">
        <button
          type="button"
          onClick={togglePlans}
          className="panel-muted group flex w-full items-center justify-between border-x-0 px-6 py-7 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#2CAD9E]/45 hover:bg-card/80 hover:shadow-[0_14px_30px_rgba(44,173,158,0.14)]"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#78f0e2]">Suggested area</p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Suggested Study Plans
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open community proposals and click a title to view its full study plan in a modal.
            </p>
          </div>
          <span className="ml-4 text-lg font-semibold text-[#78f0e2] transition-transform duration-300 group-hover:scale-110">
            {isOpen ? '−' : '+'}
          </span>
        </button>

        {isOpen && (
          <div className="panel-muted mt-3 border-x-0 p-4 animate-in fade-in-0 slide-in-from-top-2 duration-300 sm:p-5">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading suggested plans...</p>
            ) : loadError ? (
              <p className="text-sm text-rose-400">{loadError}</p>
            ) : plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suggested plans found yet.</p>
            ) : (
              <ul className="space-y-3">
                {plans.map((plan, index) => {
                  const isActive = selectedPlanId === plan.id;

                  return (
                    <li
                      key={plan.id}
                      style={{ animationDelay: `${index * 60}ms` }}
                      className={`animate-in fade-in-0 slide-in-from-bottom-1 rounded-lg border px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#2CAD9E]/45 hover:shadow-[0_10px_24px_rgba(44,173,158,0.14)] ${isActive ? 'border-[#2CAD9E]/55 bg-[#2CAD9E]/10' : 'border-border/65 bg-card/55'
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => openPlanModal(plan.id)}
                        className="text-left text-base font-semibold text-foreground underline-offset-4 transition-colors hover:text-[#78f0e2] hover:underline"
                      >
                        {plan.title}
                      </button>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        by{' '}
                        <a
                          href={plan.proposerLinkedIn}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#78f0e2] underline-offset-4 hover:underline"
                        >
                          {plan.proposerName}
                        </a>{' '}
                        · {plan.proposerStatus}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-foreground/55">{plan.major}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      <Dialog open={isModalOpen && Boolean(selectedPlan)} onOpenChange={setIsModalOpen}>
        <DialogContent className="h-[92vh] max-h-[92vh] w-[96vw] max-w-[1450px] overflow-scroll border-border/70 bg-card/95 p-0 backdrop-blur">
          {selectedPlan && (
            <div className="flex h-full flex-col">
              <DialogHeader className="border-b border-border/70 bg-card/80 px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#78f0e2]">Suggested study plan</p>
                <DialogTitle className="mt-2 text-2xl tracking-tight sm:text-3xl">{selectedPlan.title}</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  Proposed by{' '}
                  <a
                    href={selectedPlan.proposerLinkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#78f0e2] underline-offset-4 hover:underline"
                  >
                    {selectedPlan.proposerName}
                  </a>{' '}
                  · {selectedPlan.proposerStatus}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 pt-5 sm:px-6">
                <div className="animate-in fade-in-0 zoom-in-95 duration-500">
                  <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-zinc-950/65">
                    <StudyPlanBoard terms={planTerms} courses={courses} connections={planConnections} />
                  </div>
                </div>

                <section className="pt-8">
                  <article className="panel-muted border-x-0 p-6 sm:p-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#78f0e2]">Why this order</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      Reasoning
                    </h2>

                    <ol className="mt-6 space-y-5">
                      {selectedPlan.why.map((point, index) => (
                        <li key={`${selectedPlan.id}:${index}`} className="flex gap-4">
                          <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2CAD9E]/35 bg-[#2CAD9E]/10 text-sm font-semibold text-[#78f0e2]">
                            {index + 1}
                          </span>
                          <p className="text-sm leading-7 text-foreground/82 sm:text-[15px]">{point}</p>
                        </li>
                      ))}
                    </ol>

                    {selectedPlan.closing && (
                      <p className="mt-6 text-sm leading-7 text-foreground/82 sm:text-[15px]">{selectedPlan.closing}</p>
                    )}
                  </article>
                </section>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
