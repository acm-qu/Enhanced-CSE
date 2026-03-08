const MYBANNER_HOST = 'mybanner.qu.edu.qa';
const COURSE_DETAIL_PATH = '/prod/bwckctlg.p_disp_course_detail';

const REQUIRED_QUERY_KEYS = ['cat_term_in', 'subj_code_in', 'crse_numb_in'] as const;

export function normalizeCourseInfoUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.toLowerCase() !== MYBANNER_HOST) {
      return null;
    }

    if (parsed.pathname.toLowerCase() !== COURSE_DETAIL_PATH) {
      return null;
    }

    const hasAllRequiredQuery = REQUIRED_QUERY_KEYS.every((key) => {
      const value = parsed.searchParams.get(key);
      return Boolean(value && value.trim());
    });

    if (!hasAllRequiredQuery) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function isCourseInfoUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) {
    return false;
  }

  return normalizeCourseInfoUrl(rawUrl) !== null;
}
