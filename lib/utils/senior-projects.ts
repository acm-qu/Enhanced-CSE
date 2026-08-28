const SENIOR_PROJECT_REGEX = /senior\s+projects?/i;
const FALL_MARKER_REGEX = /\(\s*fall\s*\)/i;
const YEAR_REGEX = /\b(?:19|20)\d{2}\b/g;

/**
 * Upstream WordPress labels senior project archives with the year before the one they
 * actually cover, except for entries already marked "(Fall)". Corrected on read so the
 * synced rows keep the source values.
 */
export function fixSeniorProjectYear(title: string): string {
  if (!SENIOR_PROJECT_REGEX.test(title) || FALL_MARKER_REGEX.test(title)) {
    return title;
  }

  return title.replace(YEAR_REGEX, (year) => String(Number(year) + 1));
}
