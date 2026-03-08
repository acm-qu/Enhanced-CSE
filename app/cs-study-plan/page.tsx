import { readFileSync } from 'fs';
import { join } from 'path';
import type { Metadata } from 'next';

import { StudyPlanBoard } from '@/components/study-plan-board';

export const metadata: Metadata = { title: 'CS Study Plan' };

const STUDY_PLAN_HEADER_COPY = 'Custom Made Ordering the of QU 2024 Roadmap optimized for you';

const STUDY_PLAN_NOTE_POINTS = [
  `You can see from the beginning this reordering of the plan, aims to push the CS courses to earlier semesters, my reasoning for that is quite simple, you should spend the first 2 years of your CS Course learning the and last 2 applying what you learnt in a manner that leads you to achieving your career goals better.`,
  `Some the key changes you might notice is Software Engineering along with Web Development are now in Year 2 instead of Year 3. This is done because I believe these courses are the best 2 courses in QU that shape your mindset as a developer and through them, you can get an idea of what's out there and how you should structure your personal projects moving forward. Gaining that knowledge a full year earlier than other students is gonna help you somewhat stand out in the ocean of droplets that you are in.`,
  `All electives are pushed a year behind (I couldn't fit one in Year 3 Fall) this is to allow you to not miss out on an elective that you could have wanted. Also, it allows you to take an extra 1 or 2 if you want in your senior year and if the course is interesting. Electives in QU are bit more practical than the normal CS Core Courses. You also get to widen your knowledge surface a bit earlier and discover what you want to pursue.`,
  `The General Courses that add nothing to your career have been pushed as much as possible to the Year 3 and Year 4. This is due to the fact that these courses are easier than the Core courses, allowing you to spend less time on campus and you should really focus on Projects and Internship or any kind of practical work during Year 3 and Year 4 as you are getting close to hitting the job market.`,
  `You could think that this order is a hassle, as it's probably a bit harder to execute than QU's original order. I personally believe that Higher Education is less about what you actively learn and more about who you become. Putting yourself through a challenge that has decent likelihood of a reward at the end and being able to follow through with it, means that you could probably achieve anything in life later on, even if you end up choose a different field.`
] as const;

const STUDY_PLAN_NOTE_CLOSING = `I think I'm decently pragmatic in thinking that, you are here, doing this bachelors degree, to make money in some way shape or form. So why not make that your goal from the very beginning? And actively plan for it and update your plan with new input as you learn more.`;

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
  program: { name: string; institution: string; total_credit_hours_required: number };
  courses: Record<string, CourseData>;
  study_plan_terms: StudyPlanTerm[];
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

  return (
    <main className="relative z-[1] pb-10">
      <div className="px-4 pb-4 pt-8 sm:px-6">
        <p className="mb-3 inline-flex rounded-full border border-[#2CAD9E]/30 bg-[#2CAD9E]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#78f0e2]">
          Custom roadmap
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{program.name} Study Plan</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-foreground/85 sm:text-base">
          {STUDY_PLAN_HEADER_COPY}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {program.institution} | {program.total_credit_hours_required} Credit Hours | 2024 Roadmap
        </p>
      </div>

      <StudyPlanBoard terms={terms} courses={courses} connections={connections} />

      <section className="px-4 pt-8 sm:px-6">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Elective tracks</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Elective Courses by Specialization
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Suggested grouping of your elective options into common CS specializations.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ELECTIVE_SPECIALIZATIONS.map((specialization) => (
            <article key={specialization.name} className="panel-muted p-5 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground">{specialization.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{specialization.description}</p>

              <ul className="mt-4 space-y-2 text-sm leading-6 text-foreground/85">
                {specialization.courses.map((course) => (
                  <li key={course} className="rounded-md border border-border/70 bg-card/60 px-3 py-2">
                    <span className='text-[#78f0e2]'>{course.split(',')[0]}</span>&nbsp;-&nbsp;{course.split(',')[1]}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 pt-8 sm:px-6">
        <article className="panel-muted p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#78f0e2]">Why this order</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Why we believe this is the study plan fresh CS students should take.
          </h2>

          <ol className="mt-6 space-y-5">
            {STUDY_PLAN_NOTE_POINTS.map((point, index) => (
              <li key={index} className="flex gap-4">
                <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2CAD9E]/35 bg-[#2CAD9E]/10 text-sm font-semibold text-[#78f0e2]">
                  {index + 1}
                </span>
                <p className="text-sm leading-7 text-foreground/82 sm:text-[15px]">{point}</p>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-sm leading-7 text-foreground/82 sm:text-[15px]">{STUDY_PLAN_NOTE_CLOSING}</p>
        </article>
      </section>
    </main>
  );
}
