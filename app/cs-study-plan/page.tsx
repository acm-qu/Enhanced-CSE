import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Metadata } from 'next';

import {
  StudyPlanBoard,
  type StudyPlanBoardCourse,
  type StudyPlanBoardEdge,
  type StudyPlanBoardSemester
} from '@/components/study-plan-board';

export const metadata: Metadata = {
  title: 'CS Study Plan',
  description: 'Interactive semester-by-semester study plan with prerequisite and corequisite relationships.'
};

const STUDY_PLAN_FILE_PATH = path.join(process.cwd(), 'public', 'New folder', 'study-plan.json');

type ParsedRequirementNode =
  | string
  | {
      all_of?: ParsedRequirementNode[];
      any_of?: ParsedRequirementNode[];
    }
  | ParsedRequirementNode[]
  | null;

interface CourseRequisites {
  prerequisites?: {
    parsed?: ParsedRequirementNode;
  };
  corequisites?: {
    parsed?: ParsedRequirementNode;
  };
  concurrent_prerequisites_from_roadmap?: string[];
}

interface StudyPlanCourseRecord {
  title?: string;
  credit_hours?: number;
  type?: string;
  requisites?: CourseRequisites;
}

interface StudyPlanTerm {
  year: number;
  term: string;
  total_credit_hours: number;
  courses: string[];
}

interface StudyPlanDataFile {
  courses: Record<string, StudyPlanCourseRecord>;
  study_plan_terms: StudyPlanTerm[];
}

function collectReferencedCourseCodes(node: ParsedRequirementNode, out: Set<string>): void {
  if (!node) {
    return;
  }

  if (typeof node === 'string') {
    out.add(node.trim());
    return;
  }

  if (Array.isArray(node)) {
    for (const entry of node) {
      collectReferencedCourseCodes(entry, out);
    }
    return;
  }

  collectReferencedCourseCodes(node.all_of ?? null, out);
  collectReferencedCourseCodes(node.any_of ?? null, out);
}

function classifyCourseKind(code: string, course: StudyPlanCourseRecord | undefined): StudyPlanBoardCourse['kind'] {
  if (code.includes('ELECTIVE') || course?.type === 'elective_placeholder') {
    return 'elective';
  }

  if (code.includes('_PKG') || course?.type === 'package') {
    return 'package';
  }

  const prefix = code.split(' ')[0];
  if (prefix === 'CMPS' || prefix === 'CMPE') {
    return 'core';
  }

  return 'general';
}

function buildStudyPlanBoardData(data: StudyPlanDataFile): {
  semesters: StudyPlanBoardSemester[];
  edges: StudyPlanBoardEdge[];
} {
  const semesterIndexByCourse = new Map<string, number>();

  data.study_plan_terms.forEach((term, termIndex) => {
    for (const courseCode of term.courses) {
      if (!semesterIndexByCourse.has(courseCode)) {
        semesterIndexByCourse.set(courseCode, termIndex);
      }
    }
  });

  const dedupe = new Set<string>();
  const edges: StudyPlanBoardEdge[] = [];

  const addEdge = (type: StudyPlanBoardEdge['type'], source: string, target: string): void => {
    const sourceSemesterIndex = semesterIndexByCourse.get(source);
    const targetSemesterIndex = semesterIndexByCourse.get(target);
    if (sourceSemesterIndex === undefined || targetSemesterIndex === undefined) {
      return;
    }

    const key = `${type}:${source}->${target}`;
    if (dedupe.has(key)) {
      return;
    }

    dedupe.add(key);
    edges.push({
      source,
      target,
      type,
      sourceSemesterIndex,
      targetSemesterIndex
    });
  };

  for (const courseCode of semesterIndexByCourse.keys()) {
    const course = data.courses[courseCode];
    const prereqReferences = new Set<string>();
    collectReferencedCourseCodes(course?.requisites?.prerequisites?.parsed ?? null, prereqReferences);

    const coreqReferences = new Set<string>();
    collectReferencedCourseCodes(course?.requisites?.corequisites?.parsed ?? null, coreqReferences);

    for (const concurrentReference of course?.requisites?.concurrent_prerequisites_from_roadmap ?? []) {
      coreqReferences.add(concurrentReference);
    }

    for (const reference of prereqReferences) {
      if (!semesterIndexByCourse.has(reference)) {
        continue;
      }

      // If a relationship is marked concurrent/coreq in the roadmap, render only the dashed edge.
      if (coreqReferences.has(reference)) {
        continue;
      }

      addEdge('prereq', reference, courseCode);
    }

    for (const reference of coreqReferences) {
      if (semesterIndexByCourse.has(reference)) {
        addEdge('coreq', reference, courseCode);
      }
    }
  }

  edges.sort((a, b) => {
    if (a.targetSemesterIndex !== b.targetSemesterIndex) {
      return a.targetSemesterIndex - b.targetSemesterIndex;
    }

    if (a.sourceSemesterIndex !== b.sourceSemesterIndex) {
      return a.sourceSemesterIndex - b.sourceSemesterIndex;
    }

    if (a.target !== b.target) {
      return a.target.localeCompare(b.target);
    }

    if (a.source !== b.source) {
      return a.source.localeCompare(b.source);
    }

    return a.type.localeCompare(b.type);
  });

  const prereqCountByTarget = new Map<string, number>();
  const coreqCountByTarget = new Map<string, number>();

  for (const edge of edges) {
    const map = edge.type === 'prereq' ? prereqCountByTarget : coreqCountByTarget;
    map.set(edge.target, (map.get(edge.target) ?? 0) + 1);
  }

  const semesters: StudyPlanBoardSemester[] = data.study_plan_terms.map((term) => ({
    id: `${term.year}-${term.term.toLowerCase()}`,
    year: term.year,
    term: term.term,
    totalCreditHours: term.total_credit_hours,
    courses: term.courses.map((courseCode) => {
      const course = data.courses[courseCode];

      return {
        code: courseCode,
        title: course?.title ?? courseCode,
        creditHours: course?.credit_hours ?? 0,
        kind: classifyCourseKind(courseCode, course),
        prereqCount: prereqCountByTarget.get(courseCode) ?? 0,
        coreqCount: coreqCountByTarget.get(courseCode) ?? 0
      };
    })
  }));

  return { semesters, edges };
}

async function getStudyPlanData(): Promise<StudyPlanDataFile> {
  const contents = await readFile(STUDY_PLAN_FILE_PATH, 'utf8');
  return JSON.parse(contents) as StudyPlanDataFile;
}

export default async function CSStudyPlanPage() {
  const studyPlanData = await getStudyPlanData();
  const { semesters, edges } = buildStudyPlanBoardData(studyPlanData);
  const totalCourses = semesters.reduce((sum, semester) => sum + semester.courses.length, 0);
  const prereqEdgeCount = edges.filter((edge) => edge.type === 'prereq').length;
  const coreqEdgeCount = edges.filter((edge) => edge.type === 'coreq').length;

  return (
    <main className="min-h-[calc(100vh-4rem)] px-2 py-2 sm:px-3 lg:px-4">
      <section className="mx-auto w-full max-w-[120rem] space-y-2.5">
        <header className="glass-panel rounded-xl px-4 py-3 sm:px-5">
          <p className="section-kicker">Program Roadmap</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Computer Science Study Plan</h1>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-foreground/75 sm:text-sm">
            Semester-by-semester view of the CS roadmap with prerequisite and corequisite relationships across all
            terms.
          </p>

          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold text-foreground/75">
            <span className="rounded-full border border-border/70 bg-card/70 px-2 py-1">{semesters.length} Semesters</span>
            <span className="rounded-full border border-border/70 bg-card/70 px-2 py-1">{totalCourses} Courses</span>
            <span className="rounded-full border border-border/70 bg-card/70 px-2 py-1">{prereqEdgeCount} Prereq Arrows</span>
            <span className="rounded-full border border-border/70 bg-card/70 px-2 py-1">{coreqEdgeCount} Coreq Arrows</span>
          </div>
        </header>

        <StudyPlanBoard semesters={semesters} edges={edges} />
      </section>
    </main>
  );
}
