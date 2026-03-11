interface OfferedCourse {
  code: string;
  title: string;
  url: string;
  prerequisite: string;
  coListedWith?: string;
}

interface OfferedTerm {
  term: string;
  cs: OfferedCourse[];
  ce: OfferedCourse[];
}

const CURRENT_ELECTIVES: OfferedTerm[] = [
  {
    term: 'Fall 2025',
    cs: [
      {
        code: 'CMPS 312',
        title: 'Mobile Application Development',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202420&subj_code_in=CMPS&crse_numb_in=312',
        prerequisite: 'CMPS 251'
      },
      {
        code: 'CMPS 381',
        title: 'Applied Cryptography',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPS&crse_numb_in=381',
        prerequisite: 'CMPS 380'
      },
      {
        code: 'CMPS 403',
        title: 'Artificial Intelligence',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPS&crse_numb_in=403',
        prerequisite: 'CMPS 303'
      },
      {
        code: 'CMPS 497',
        title: 'Special Topics in Multimedia Networks',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202420&subj_code_in=CMPS&crse_numb_in=497',
        prerequisite: 'CMPE 355',
        coListedWith: 'CMPE 482'
      }
    ],
    ce: [
      {
        code: 'CMPS 312',
        title: 'Mobile Application Development',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPS&crse_numb_in=312',
        prerequisite: 'CMPS 251'
      },
      {
        code: 'CMPS 380',
        title: 'Cybersecurity Fundamentals',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPS&crse_numb_in=380',
        prerequisite: 'CMPS 303'
      },
      {
        code: 'CMPS 381',
        title: 'Applied Cryptography',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPS&crse_numb_in=381',
        prerequisite: 'CMPS 380'
      },
      {
        code: 'CMPE 471',
        title: 'Selected Topics in Artificial Intelligence',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202420&subj_code_in=CMPE&crse_numb_in=471',
        prerequisite: 'CMPS 303',
        coListedWith: 'CMPS 403'
      },
      {
        code: 'CMPE 482',
        title: 'Multimedia Networks',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPE&crse_numb_in=482',
        prerequisite: 'CMPE 355'
      }
    ]
  },
  {
    term: 'Spring 2026',
    cs: [
      {
        code: 'CMPS 434',
        title: 'Game Design and Development',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPS&crse_numb_in=434',
        prerequisite: 'CMPS 251'
      },
      {
        code: 'CMPS 460',
        title: 'Machine Learning',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPS&crse_numb_in=460',
        prerequisite: 'CMPS 303 and GENG 200'
      },
      {
        code: 'CMPS 497',
        title: 'Special Topics in Digital Forensics',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202420&subj_code_in=CMPS&crse_numb_in=497',
        prerequisite: 'CMPS 303',
        coListedWith: 'CMPS 483'
      }
    ],
    ce: [
      {
        code: 'CMPS 460',
        title: 'Machine Learning',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPS&crse_numb_in=460',
        prerequisite: 'CMPS 303 and GENG 200'
      },
      {
        code: 'CMPE 471',
        title: 'Special Topics in Digital Forensics',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202420&subj_code_in=CMPE&crse_numb_in=471',
        prerequisite: 'CMPS 303',
        coListedWith: 'CMPS 483'
      },
      {
        code: 'CMPE 483',
        title: 'Introduction to Robotics',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPE&crse_numb_in=483',
        prerequisite: 'CMPS 151 and CMPE 261'
      },
      {
        code: 'CMPE 485',
        title: 'Fundamentals of Digital Image Processing',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202420&subj_code_in=CMPE&crse_numb_in=485',
        prerequisite: 'ELEC 351'
      },
      {
        code: 'CMPS 485',
        title: 'Network Security',
        url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202410&subj_code_in=CMPS&crse_numb_in=485',
        prerequisite: 'CMPE 355 and CMPS 380'
      }
    ]
  }
];

const CYBERSECURITY_ELECTIVE = {
  term: 'Spring 2026',
  code: 'CMPS 483',
  title: 'Digital Forensics',
  url: 'https://mybanner.qu.edu.qa/PROD/bwckctlg.p_disp_course_detail?cat_term_in=202420&subj_code_in=CMPS&crse_numb_in=483',
  prerequisite: 'CMPS 380'
};

function OfferedCoursesList({ courses }: { courses: OfferedCourse[] }) {
  return (
    <ul className="space-y-2.5">
      {courses.map((course) => (
        <li key={`${course.code}:${course.title}`} className="rounded-md border border-border/60 bg-card/60 px-3 py-2">
          <a
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#78f0e2] underline-offset-4 hover:underline"
          >
            {course.code}
          </a>{' '}
          <span className="text-foreground/90">{course.title}</span>
          <p className="mt-1 text-xs text-muted-foreground">Prerequisite: {course.prerequisite}</p>
          {course.coListedWith && (
            <p className="mt-0.5 text-xs text-muted-foreground">Co-listed with {course.coListedWith}</p>
          )}
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
        <p className="mt-1 max-w-3xl text-xs text-muted-foreground sm:text-sm">
          Adapted from the official CSE Wiki electives-offered page (updated Jan 18, 2026).
        </p>
      </div>

      <div className="panel-muted border-x-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead className="bg-card/80">
              <tr className="border-b border-border/70">
                <th className="w-[150px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Term
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  CS
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  CE
                </th>
              </tr>
            </thead>
            <tbody>
              {CURRENT_ELECTIVES.map((term) => (
                <tr key={term.term} className="align-top border-t border-border/60">
                  <td className="px-4 py-4 text-sm font-semibold text-foreground">{term.term}</td>
                  <td className="px-4 py-4">
                    <OfferedCoursesList courses={term.cs} />
                  </td>
                  <td className="px-4 py-4">
                    <OfferedCoursesList courses={term.ce} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border/70 bg-card/45 px-4 py-3 text-xs text-muted-foreground sm:text-sm">
          <span className="font-semibold text-foreground/90">Cybersecurity Elective ({CYBERSECURITY_ELECTIVE.term}): </span>
          <a
            href={CYBERSECURITY_ELECTIVE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#78f0e2] underline-offset-4 hover:underline"
          >
            {CYBERSECURITY_ELECTIVE.code}
          </a>{' '}
          {CYBERSECURITY_ELECTIVE.title} (Prerequisite: {CYBERSECURITY_ELECTIVE.prerequisite})
        </div>
      </div>
    </section>
  );
}
