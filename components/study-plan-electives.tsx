'use client';

import { useState } from 'react';

import { CourseInfoDialog } from '@/components/course-info-dialog';
import { isCourseInfoUrl } from '@/lib/utils/course-info-url';

export interface StudyPlanElectiveCourse {
  id: string;
  title: string;
  url?: string;
}

export interface StudyPlanElectiveSpecialization {
  name: string;
  description: string;
  courses: StudyPlanElectiveCourse[];
}

interface StudyPlanElectivesProps {
  specializations: StudyPlanElectiveSpecialization[];
}

export function StudyPlanElectives({ specializations }: StudyPlanElectivesProps) {
  const [selectedCourse, setSelectedCourse] = useState<StudyPlanElectiveCourse | null>(null);

  return (
    <section className="px-4 pt-6 sm:px-6">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Elective tracks</p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Elective Courses by Specialization
        </h2>
        <p className="mt-1 max-w-3xl text-xs text-muted-foreground sm:text-sm">
          Suggested grouping of your elective options into common CS specializations.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {specializations.map((specialization) => (
          <article key={specialization.name} className="panel-muted border-x-0 p-4">
            <h3 className="text-base font-semibold text-foreground">{specialization.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{specialization.description}</p>

            <ul className="mt-3 space-y-1.5 text-xs leading-5 text-foreground/85">
              {specialization.courses.map((course) => {
                const cardClassName =
                  'block w-full rounded-md border border-border/70 bg-card/60 px-3 py-1.5 text-left transition-colors hover:border-[#2CAD9E]/40 hover:bg-card/85';
                const shouldOpenModal = isCourseInfoUrl(course.url);

                return (
                  <li key={`${specialization.name}:${course.id}`}>
                    {course.url && shouldOpenModal ? (
                      <button
                        type="button"
                        onClick={() => setSelectedCourse(course)}
                        className={cardClassName}
                      >
                        <span className="text-[#78f0e2]">{course.id}</span>&nbsp;-&nbsp;{course.title}
                      </button>
                    ) : course.url ? (
                      <a
                        href={course.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cardClassName}
                      >
                        <span className="text-[#78f0e2]">{course.id}</span>&nbsp;-&nbsp;{course.title}
                      </a>
                    ) : (
                      <div className="rounded-md border border-border/70 bg-card/60 px-3 py-1.5">
                        <span className="text-[#78f0e2]">{course.id}</span>&nbsp;-&nbsp;{course.title}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>

      <CourseInfoDialog
        open={Boolean(selectedCourse)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCourse(null);
          }
        }}
        sourceUrl={selectedCourse?.url}
        fallbackCourseId={selectedCourse?.id}
        fallbackTitle={selectedCourse?.title}
      />
    </section>
  );
}
