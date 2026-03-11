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

const ELECTIVE_SPECIALIZATIONS = [
  {
    name: 'AI & Data Science',
    description: 'Data-driven intelligence, prediction, search, and perception.',
    courses: [
      'CMPS 360,Data Science Fundamentals',
      'CMPS 403,Artificial Intelligence',
      'CMPS 453,Data Mining',
      'CMPS 460,Machine Learning',
      'CMPE 480,Computer Vision'
    ]
  },
  {
    name: 'Game Development & Graphics',
    description: 'Visual systems, interactive media, and game production.',
    courses: [
      'CMPS 373,Computer Graphics',
      'CMPS 433,Multimedia Systems',
      'CMPS 434,Game Design and Development'
    ]
  },
  {
    name: 'Software Engineering & Product',
    description: 'Application design and implementation for modern products.',
    courses: [
      'CMPS 312,Mobile Application Development',
      'CMPS 356,Web Applications Design and Development'
    ]
  },
  {
    name: 'Databases & Information Systems',
    description: 'Storage, retrieval, and organization of large information systems.',
    courses: ['CMPS 451,Database Management Systems', 'CMPS 466,Information Retrieval']
  },
  {
    name: 'Systems, Security & Networks',
    description: 'Secure, scalable, and high-performance computing infrastructure.',
    courses: [
      'CMPS 381,Applied Cryptography',
      'CMPS 465,Parallel Computing',
      'CMPE 488,Wireless Networks and Applications'
    ]
  },
  {
    name: 'Simulation & Professional Practice',
    description: 'Applied modeling, industry exposure, and advanced topics.',
    courses: [
      'CMPS 393,Modeling and Simulation',
      'CMPS 399,Practical Training',
      'CMPS 497,Special Topics in Computing'
    ]
  }
] as const;

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

function parseSpecializationCourse(value: string): { id: string; title: string } {
  const separatorIndex = value.indexOf(',');
  if (separatorIndex === -1) {
    return { id: value.trim(), title: value.trim() };
  }

  return {
    id: value.slice(0, separatorIndex).trim(),
    title: value.slice(separatorIndex + 1).trim()
  };
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

  const electiveSpecializations: StudyPlanElectiveSpecialization[] = ELECTIVE_SPECIALIZATIONS.map((specialization) => ({
    name: specialization.name,
    description: specialization.description,
    courses: specialization.courses.map((courseValue) => {
      const { id, title } = parseSpecializationCourse(courseValue);
      const url =
        courses[id]?.sources?.mybanner_url ??
        buildMyBannerCourseUrl(id, program.source_documents?.mybanner_course_detail_template);

      return {
        id,
        title,
        url
      };
    })
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
