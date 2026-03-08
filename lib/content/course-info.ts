import { decode } from 'he';

const KNOWN_FIELD_LABELS = [
  'Levels:',
  'Schedule Types:',
  'Course Attributes:',
  'Restrictions:',
  'Prerequisites:',
  'Corequisites:'
] as const;

export interface ParsedCourseHours {
  min: number;
  max: number;
  text: string;
}

export interface ParsedCourseInfo {
  sourceUrl: string;
  heading: string;
  courseId?: string;
  title: string;
  description?: string;
  creditHours?: ParsedCourseHours;
  lectureHours?: string;
  labHours?: string;
  levels: string[];
  scheduleTypes: string[];
  department?: string;
  courseAttributes: string[];
  restrictions?: string;
  prerequisites?: string;
  corequisites?: string;
}

function stripAndDecodeHtml(value: string): string {
  return decode(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '');
}

function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toLines(value: string): string[] {
  return stripAndDecodeHtml(value)
    .split('\n')
    .map((line) => normalizeInlineText(line))
    .filter(Boolean)
    .filter((line) =>
      ![
        'Return to Previous',
        'New Search',
        'Skip to top of page',
        'Transparent Image'
      ].includes(line)
    );
}

function isLabelLine(line: string): boolean {
  const normalized = line.toLowerCase();
  return KNOWN_FIELD_LABELS.some((label) => normalized.startsWith(label.toLowerCase()));
}

function extractSection(lines: string[], label: (typeof KNOWN_FIELD_LABELS)[number]): string | undefined {
  const index = lines.findIndex((line) => line.toLowerCase().startsWith(label.toLowerCase()));
  if (index < 0) {
    return undefined;
  }

  const firstLine = lines[index] ?? '';
  const inlineValue = normalizeInlineText(firstLine.slice(label.length));
  const collected: string[] = [];
  if (inlineValue) {
    collected.push(inlineValue);
  }

  for (let lineIndex = index + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? '';
    if (isLabelLine(line)) {
      break;
    }

    if (line === 'All Sections for this Course' || line === 'Syllabus Available') {
      continue;
    }

    collected.push(line);
  }

  const joined = normalizeInlineText(collected.join(' '));
  return joined || undefined;
}

function splitList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => normalizeInlineText(item))
    .filter(Boolean);
}

function parseHourRange(value: string | undefined, suffix: string): ParsedCourseHours | undefined {
  if (!value) {
    return undefined;
  }

  const toRangeMatch = value.match(/(\d+(?:\.\d+)?)\s+TO\s+(\d+(?:\.\d+)?)\s+/i);
  if (toRangeMatch) {
    const min = Number.parseFloat(toRangeMatch[1]);
    const max = Number.parseFloat(toRangeMatch[2]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return {
        min,
        max,
        text: `${toRangeMatch[1]} TO ${toRangeMatch[2]} ${suffix}`
      };
    }
  }

  const singleMatch = value.match(/(\d+(?:\.\d+)?)\s+/i);
  if (!singleMatch) {
    return undefined;
  }

  const parsed = Number.parseFloat(singleMatch[1]);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return {
    min: parsed,
    max: parsed,
    text: `${singleMatch[1]} ${suffix}`
  };
}

function extractTitleInfo(titleLine: string): { courseId?: string; title: string } {
  const match = titleLine.match(/^([A-Z]{2,}\s+\d{3}[A-Z]?)\s*-\s*(.+)$/);
  if (!match) {
    return { title: titleLine };
  }

  return {
    courseId: normalizeInlineText(match[1]),
    title: normalizeInlineText(match[2])
  };
}

export function parseCourseInfoHtml(sourceUrl: string, html: string): ParsedCourseInfo {
  const tableMatch = html.match(
    /<table[^>]*class=["']datadisplaytable["'][^>]*summary=["'][^"']*course detail[^"']*["'][^>]*>[\s\S]*?<\/table>/i
  );
  const scope = tableMatch?.[0] ?? html;

  const titleMatch = scope.match(/<td[^>]*class=["']nttitle["'][^>]*>([\s\S]*?)<\/td>/i);
  const detailMatch = scope.match(/<td[^>]*class=["']ntdefault["'][^>]*>([\s\S]*?)<\/td>/i);

  if (!titleMatch?.[1] || !detailMatch?.[1]) {
    throw new Error('Could not extract course detail content from source page');
  }

  const heading = normalizeInlineText(stripAndDecodeHtml(titleMatch[1]));
  const titleInfo = extractTitleInfo(heading);
  const lines = toLines(detailMatch[1]);

  let creditHoursLine = lines.find((line) => /\bCredit hours\b/i.test(line));
  if (creditHoursLine?.includes(' OR ')) {
    creditHoursLine = creditHoursLine.split(' OR ')[1];
  }
  let lectureHoursLine = lines.find((line) => /\bLecture hours\b/i.test(line));
  if (lectureHoursLine?.includes(' OR ')) {
    lectureHoursLine = lectureHoursLine.split(' OR ')[1];
  }
  let labHoursLine = lines.find((line) => /\bLab hours\b/i.test(line));
  if (labHoursLine?.includes(' OR ')) {
    labHoursLine = labHoursLine.split(' OR ')[1];
  }

  const creditHoursIndex = creditHoursLine ? lines.indexOf(creditHoursLine) : -1;
  const description = normalizeInlineText(
    (creditHoursIndex > 0 ? lines.slice(0, creditHoursIndex) : lines.slice(0, 1)).join(' ')
  );

  const department = lines.find((line) => /\bDepartment\b$/i.test(line));
  const levels = splitList(extractSection(lines, 'Levels:'));
  const scheduleTypes = splitList(extractSection(lines, 'Schedule Types:'));
  const courseAttributes = splitList(extractSection(lines, 'Course Attributes:'));

  return {
    sourceUrl,
    heading,
    courseId: titleInfo.courseId,
    title: titleInfo.title,
    description: description || undefined,
    creditHours: parseHourRange(creditHoursLine, 'Credit hours'),
    lectureHours: lectureHoursLine,
    labHours: labHoursLine,
    levels,
    scheduleTypes,
    department,
    courseAttributes,
    restrictions: extractSection(lines, 'Restrictions:'),
    prerequisites: extractSection(lines, 'Prerequisites:'),
    corequisites: extractSection(lines, 'Corequisites:')
  };
}
