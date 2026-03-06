import { readFileSync } from 'fs';
import { join } from 'path';
import type { Metadata } from 'next';

import { StudyPlanBoard } from '@/components/study-plan-board';

export const metadata: Metadata = { title: 'CS Study Plan' };

export type Connection = { from: string; to: string; type: 'prereq' | 'concurrent' };

// ─── JSON shape ───────────────────────────────────────────────────────────────
interface ParsedReq {
  all_of?: ParsedReqItem[];
  any_of?: ParsedReqItem[];
}
type ParsedReqItem = string | ParsedReq;

export interface CourseData {
  title: string;
  credit_hours: number;
  schedule_types?: string[];
  department?: string;
  attributes?: string[];
  type?: string;
  requisites: {
    prerequisites: { text: string; parsed: ParsedReq | null };
    corequisites: { text: string; parsed: ParsedReq | null };
    concurrent_prerequisites_from_roadmap: string[];
  };
  notes?: string[];
  program_policy_overrides?: string[];
}

export interface StudyPlanTerm {
  year: number;
  term: string;
  total_credit_hours: number;
  courses: string[];
}

interface StudyPlanJson {
  program: { name: string; institution: string; total_credit_hours_required: number };
  courses: Record<string, CourseData>;
  study_plan_terms: StudyPlanTerm[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CsStudyPlanPage() {
  const raw = readFileSync(join(process.cwd(), 'public', 'New folder', 'study-plan.json'), 'utf-8');
  const data = JSON.parse(raw) as StudyPlanJson;
  const { courses, study_plan_terms: terms, program } = data;

  const planIds = new Set(terms.flatMap((t) => t.courses));
  const seen = new Set<string>();
  const connections: Connection[] = [];

  for (const [id, course] of Object.entries(courses)) {
    if (!planIds.has(id)) continue;

    for (const fromId of extractIds(course.requisites?.prerequisites?.parsed)) {
      if (!planIds.has(fromId)) continue;
      const key = `pre:${fromId}→${id}`;
      if (!seen.has(key)) { seen.add(key); connections.push({ from: fromId, to: id, type: 'prereq' }); }
    }

    for (const fromId of (course.requisites?.concurrent_prerequisites_from_roadmap ?? [])) {
      if (!planIds.has(fromId)) continue;
      const key = `con:${fromId}→${id}`;
      if (!seen.has(key)) { seen.add(key); connections.push({ from: fromId, to: id, type: 'concurrent' }); }
    }
  }

  return (
    <main className="relative z-[1] pb-6">
      <div className="px-4 pt-8 pb-4 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">{program.name} Study Plan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {program.institution} · {program.total_credit_hours_required} Credit Hours · 2024 Roadmap
        </p>
      </div>
      <StudyPlanBoard terms={terms} courses={courses} connections={connections} />
    </main>
  );
}
