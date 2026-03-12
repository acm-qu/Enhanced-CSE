import { readFileSync } from 'fs';
import { join } from 'path';
import type { Metadata } from 'next';

import {
  StudyPlanElectives,
  type StudyPlanElectiveSpecialization
} from '@/components/study-plan-electives';
import { StudyPlanElectivesOfferedTable } from '@/components/study-plan-electives-offered-table';
import { SuggestedStudyPlans } from '../../components/suggested-study-plans';

export const metadata: Metadata = { title: 'CS Study Plan' };

const STUDY_PLAN_HEADER_COPY = 'Custom Made Ordering the of QU 2024 Roadmap optimized for you';

interface ElectiveCourseData {
  id: string;
  title: string;
  specialization: string;
  sources?: { mybanner_url?: string };
}

interface ElectivesJson {
  specializations: Record<string, { description: string }>;
  electives: ElectiveCourseData[];
}

export type Connection = { from: string; to: string; type: 'prereq' | 'concurrent' };

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
  sources?: { mybanner_url?: string; catalog_term?: string; roadmap_url?: string };
}

export interface StudyPlanTerm {
  year: number;
  term: string;
  total_credit_hours: number;
  courses: string[];
}

interface StudyPlanJson {
  program: {
    name: string;
    institution: string;
    total_credit_hours_required: number;
    source_documents?: {
      mybanner_course_detail_template?: string;
    };
  };
  courses: Record<string, CourseData>;
  study_plan_terms: StudyPlanTerm[];
}

function buildMyBannerCourseUrl(courseId: string, template?: string): string | undefined {
  const match = courseId.match(/^([A-Z]+)\s+(\d{3})$/);
  if (!match) {
    return undefined;
  }

  const [, subject, number] = match;
  const normalizedTemplate =
    template ??
    'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in={TERM}&subj_code_in={SUBJECT}&crse_numb_in={NUMBER}';

  return normalizedTemplate
    .replace('{TERM}', '202410')
    .replace('{SUBJECT}', subject)
    .replace('{NUMBER}', number);
}

function extractIds(parsed: ParsedReq | null | undefined): string[] {
  if (!parsed) {
    return [];
  }

  const ids: string[] = [];
  const walk = (item: ParsedReqItem) => {
    if (typeof item === 'string') {
      ids.push(item);
      return;
    }

    item.all_of?.forEach(walk);
    item.any_of?.forEach(walk);
  };

  parsed.all_of?.forEach(walk);
  parsed.any_of?.forEach(walk);
  return ids;
}

export default function CsStudyPlanPage() {
  const raw = readFileSync(join(process.cwd(), 'public', 'New folder', 'study-plan.json'), 'utf-8');
  const data = JSON.parse(raw) as StudyPlanJson;
  const { courses, study_plan_terms: terms, program } = data;

  const electivesRaw = readFileSync(join(process.cwd(), 'public', 'New folder', 'electives.json'), 'utf-8');
  const electivesData = JSON.parse(electivesRaw) as ElectivesJson;

  const planIds = new Set(terms.flatMap((term) => term.courses));
  const seen = new Set<string>();
  const connections: Connection[] = [];

  for (const [id, course] of Object.entries(courses)) {
    if (!planIds.has(id)) {
      continue;
    }

    for (const fromId of extractIds(course.requisites?.prerequisites?.parsed)) {
      if (!planIds.has(fromId)) {
        continue;
      }

      const key = `pre:${fromId}->${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        connections.push({ from: fromId, to: id, type: 'prereq' });
      }
    }

    for (const fromId of course.requisites?.concurrent_prerequisites_from_roadmap ?? []) {
      if (!planIds.has(fromId)) {
        continue;
      }

      const key = `con:${fromId}->${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        connections.push({ from: fromId, to: id, type: 'concurrent' });
      }
    }
  }

  // Group electives by specialization
  const electivesBySpecialization = electivesData.electives.reduce(
    (acc, elective) => {
      if (!acc[elective.specialization]) {
        acc[elective.specialization] = [];
      }
      acc[elective.specialization].push(elective);
      return acc;
    },
    {} as Record<string, ElectiveCourseData[]>
  );

  const electiveSpecializations: StudyPlanElectiveSpecialization[] = Object.entries(
    electivesBySpecialization
  ).map(([specialization, courseList]) => ({
    name: specialization,
    description: electivesData.specializations[specialization]?.description ?? '',
    courses: courseList.map((elective) => ({
      id: elective.id,
      title: elective.title,
      url: elective.sources?.mybanner_url ?? buildMyBannerCourseUrl(elective.id, program.source_documents?.mybanner_course_detail_template)
    }))
  }));

  return (
    <main className="relative z-[1] pb-10">
      <div className="px-4 pb-4 pt-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{program.name} Study Plan</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-foreground/85 sm:text-base">
          {STUDY_PLAN_HEADER_COPY}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {program.institution} | {program.total_credit_hours_required} Credit Hours | 2024 Roadmap
        </p>
      </div>

      <SuggestedStudyPlans terms={terms} courses={courses} connections={connections} />

      <StudyPlanElectivesOfferedTable />

      <StudyPlanElectives specializations={electiveSpecializations} />
    </main>
  );
}
