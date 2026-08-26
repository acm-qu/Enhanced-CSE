import { Fragment } from 'react';

const MYBANNER_COURSE_URL =
  'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in={TERM}&subj_code_in={SUBJECT}&crse_numb_in={NUMBER}';

interface OfferedCourse {
  code: string;
  title: string;
  /** Shown as "Replacing and equivalent to …" — the course this one supersedes. */
  equivalentTo?: string;
  coListedWith?: string;
  prerequisite?: string;
  /** Marker tying the course to one of the pending-approval notes above the table. */
  footnote?: 'AE1' | 'AE2';
}

interface OfferedTerm {
  term: string;
  /** Banner catalog term: <year>10 for Fall, <year>20 for Spring. */
  catalogTerm: string;
  cs: OfferedCourse[];
  ce: OfferedCourse[];
}

const CURRENT_ELECTIVES: OfferedTerm[] = [
  {
    term: 'Fall 2026',
    catalogTerm: '202610',
    cs: [
      {
        code: 'CMAI 340',
        title: 'Artificial Intelligence Fundamentals',
        equivalentTo: 'CMPS 403 Artificial Intelligence'
      },
      { code: 'CMPS 360', title: 'Data Science' },
      { code: 'CMPS 381', title: 'Applied Cryptography' },
      {
        code: 'CMAI 480',
        title: 'Computer Vision',
        equivalentTo: 'CMPE 480 Computer Vision'
      },
      { code: 'CMPE 488', title: 'Wireless Networks and Applications' }
    ],
    ce: [
      { code: 'CMPS 380', title: 'Cybersecurity Fundamentals' },
      { code: 'CMPS 381', title: 'Applied Cryptography' },
      {
        code: 'CMAI 480',
        title: 'Computer Vision',
        equivalentTo: 'CMPE 480 Computer Vision'
      },
      { code: 'CMPE 488', title: 'Wireless Networks and Applications' }
    ]
  },
  {
    term: 'Spring 2027',
    catalogTerm: '202620',
    cs: [
      { code: 'CMPS 373', title: 'Computer Graphics' },
      { code: 'CMAI 361', title: 'Deep Learning', footnote: 'AE1' },
      {
        code: 'CMPS 497',
        title: 'Special Topics in Ethical Hacking',
        coListedWith: 'CMPS 474',
        prerequisite: 'CMPS 380'
      }
    ],
    ce: [
      { code: 'CMAI 361', title: 'Deep Learning' },
      { code: 'CMPE 483', title: 'Introduction to Robotics' },
      { code: 'CMPE 485', title: 'Fundamentals of Digital Image Processing' }
    ]
  }
];

const CYBERSECURITY_ELECTIVE = {
  heading: 'Cybersecurity Elective - Spring 2027',
  catalogTerm: '202620',
  course: {
    code: 'CMPS 474',
    title: 'Ethical Hacking',
    prerequisite: 'CMPS 380',
    footnote: 'AE2'
  } satisfies OfferedCourse
};

const PENDING_APPROVAL_NOTES = [
  {
    marker: 'AE1',
    courseCode: 'CMAI 361',
    body:
      ' Deep Learning to CS and CE electives will be submitted early Fall 2026. Otherwise Special Topics will be used.'
  },
  {
    marker: 'AE2',
    courseCode: 'CMPS 474',
    body:
      ' Ethical Hacking to CS Cybersecurity electives will be submitted early Fall 2026. Otherwise Special Topics will be used.'
  }
] as const;

function buildCourseUrl(code: string, catalogTerm: string): string {
  const [subject, number] = code.split(' ');

  return MYBANNER_COURSE_URL.replace('{TERM}', catalogTerm)
    .replace('{SUBJECT}', subject)
    .replace('{NUMBER}', number);
}

function CourseLink({ code, catalogTerm }: { code: string; catalogTerm: string }) {
  return (
    <a
      href={buildCourseUrl(code, catalogTerm)}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-[#78f0e2] underline-offset-4 hover:underline"
    >
      {code}
    </a>
  );
}

function OfferedCourseEntry({ course, catalogTerm }: { course: OfferedCourse; catalogTerm: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-card/60 px-3 py-2">
      <CourseLink code={course.code} catalogTerm={catalogTerm} />{' '}
      <span className="text-foreground/90">{course.title}</span>
      {course.footnote && (
        <sup className="ml-0.5 text-[10px] font-semibold text-[#78f0e2]">[{course.footnote}]</sup>
      )}
      {course.equivalentTo && (
        <p className="mt-1 text-xs text-muted-foreground">Replacing and equivalent to {course.equivalentTo}</p>
      )}
      {(course.coListedWith || course.prerequisite) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {course.coListedWith && <>Co-listed with {course.coListedWith}</>}
          {course.coListedWith && course.prerequisite && ' · '}
          {course.prerequisite && <>Prerequisite: {course.prerequisite}</>}
        </p>
      )}
    </div>
  );
}

function OfferedCoursesList({ courses, catalogTerm }: { courses: OfferedCourse[]; catalogTerm: string }) {
  if (courses.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  return (
    <ul className="space-y-2.5">
      {courses.map((course) => (
        <li key={`${course.code}:${course.title}`}>
          <OfferedCourseEntry course={course} catalogTerm={catalogTerm} />
        </li>
      ))}
    </ul>
  );
}

export function StudyPlanElectivesOfferedTable() {
  return (
    <section className="px-4 pt-6 sm:px-6">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Electives offered</p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Current Electives Offered
        </h2>
        <div className="mt-2 max-w-3xl space-y-1.5 text-xs text-muted-foreground sm:text-sm">
          {PENDING_APPROVAL_NOTES.map((note) => (
            <p key={note.marker}>
              <span className="font-semibold text-foreground/90">[{note.marker}]</span> Request to add{' '}
              <CourseLink code={note.courseCode} catalogTerm="202620" />
              {note.body}
            </p>
          ))}
        </div>
      </div>

      <div className="panel-muted border-x-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-card/80">
              <tr className="border-b border-border/70">
                <th className="w-1/2 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  CS
                </th>
                <th className="w-1/2 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  CE
                </th>
              </tr>
            </thead>
            <tbody>
              {CURRENT_ELECTIVES.map((term) => (
                <Fragment key={term.term}>
                  <tr className="border-t border-border/60 bg-card/45">
                    <th
                      scope="colgroup"
                      className="px-4 py-2.5 text-left text-sm font-semibold text-foreground"
                    >
                      {term.term}
                    </th>
                    <th
                      scope="colgroup"
                      className="px-4 py-2.5 text-left text-sm font-semibold text-foreground"
                    >
                      {term.term}
                    </th>
                  </tr>
                  <tr className="align-top">
                    <td className="px-4 py-4">
                      <OfferedCoursesList courses={term.cs} catalogTerm={term.catalogTerm} />
                    </td>
                    <td className="px-4 py-4">
                      <OfferedCoursesList courses={term.ce} catalogTerm={term.catalogTerm} />
                    </td>
                  </tr>
                </Fragment>
              ))}

              <tr className="border-t border-border/60 bg-card/45">
                <th
                  scope="colgroup"
                  colSpan={2}
                  className="px-4 py-2.5 text-left text-sm font-semibold text-foreground"
                >
                  {CYBERSECURITY_ELECTIVE.heading}
                </th>
              </tr>
              <tr className="align-top">
                <td colSpan={2} className="px-4 py-4">
                  <OfferedCourseEntry
                    course={CYBERSECURITY_ELECTIVE.course}
                    catalogTerm={CYBERSECURITY_ELECTIVE.catalogTerm}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
