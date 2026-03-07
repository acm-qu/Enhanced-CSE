import sanitizeHtml from 'sanitize-html';

import { decodeHtmlEntities } from '@/lib/utils/content';

const DEFAULT_SUMMARY_LENGTH = 220;
const BLOCK_REGEX = /<(p|li|blockquote|figcaption|h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
const COURSE_CODE_REGEX = /\b[A-Z]{4}\s+\d{3}\b/g;
const TERM_LABEL_REGEX = /\b(?:Fall|Spring|Summer)\s+\d{4}\b/g;
const COURSE_NAME_REGEX = /\b[A-Z]{4}\s+\d{3}\s+([A-Za-z][A-Za-z/&,' -]{3,80}?)(?=(?:\s+\(|\s+[-—]\s+|\s+co-listed|\s+[A-Z]{4}\s+\d{3}\b|$))/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    sanitizeHtml(
      html
        .replace(/<(br|hr)\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|section|article|aside|header|footer|li|ul|ol|h[1-6]|figure|figcaption|blockquote|table|tr|td|th)>/gi, ' ')
        .replace(/<(li|p|div|section|article|blockquote|figcaption|h[1-6])[^>]*>/gi, ' '),
      {
        allowedTags: [],
        allowedAttributes: {}
      }
    )
  )
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBlocks(html?: string): string[] {
  if (!html) {
    return [];
  }

  const blocks: string[] = [];

  for (const match of html.matchAll(BLOCK_REGEX)) {
    const text = htmlToText(match[2] ?? '');
    if (text) {
      blocks.push(text);
    }
  }

  return blocks;
}

function stripLeadingNoise(text: string, title: string): string {
  let result = text.trim();
  const escapedTitle = escapeRegExp(title.trim());
  const lower = result.toLowerCase();
  const printIndex = lower.indexOf(' print ');

  if (printIndex >= 0 && printIndex < 140) {
    result = result.slice(printIndex + ' print '.length).trim();
  } else if (lower.startsWith('print ')) {
    result = result.slice('print '.length).trim();
  }

  for (let i = 0; i < 8; i += 1) {
    const next = result
      .replace(new RegExp(`^${escapedTitle}\\s*`, 'i'), '')
      .replace(/^main\s+/i, '')
      .replace(/^(posted|updated)\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}(?:\s+at\s+\d{1,2}:\d{2}\s*(?:AM|PM))?\s*/i, '')
      .replace(/^by\s+[A-Za-z0-9._'-]{2,20}(?:\s+[A-Za-z0-9._'-]{2,20}){0,3}\s*/i, '')
      .replace(/^(watch\s+)?project\s+id\s*=\s*[A-Za-z0-9 -]{1,30}\s*/i, '')
      .replace(/^supervisor:\s+[A-Za-z .'-]{3,80}\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (next === result) {
      break;
    }

    result = next;
  }

  return result
    .replace(/^(posted|updated|by)\b/i, '')
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsefulSummary(text: string, title: string): boolean {
  if (!text || text.length < 48) {
    return false;
  }

  if (text.toLowerCase() === title.trim().toLowerCase()) {
    return false;
  }

  return /[A-Za-z]{3}/.test(text);
}

function looksLikeCourseInventory(text: string): boolean {
  const courseMatches = text.match(COURSE_CODE_REGEX)?.length ?? 0;
  const termMatches = text.match(TERM_LABEL_REGEX)?.length ?? 0;
  return courseMatches >= 3 || (courseMatches >= 2 && termMatches >= 2);
}

function extractCourseNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const match of text.matchAll(COURSE_NAME_REGEX)) {
    const name = match[1]?.replace(/\s+/g, ' ').trim();
    if (!name || name.length < 4 || seen.has(name.toLowerCase())) {
      continue;
    }

    seen.add(name.toLowerCase());
    names.push(name);
  }

  return names;
}

function joinHumanList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? '';
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function buildCourseInventorySummary(title: string, contentHtml?: string, excerptHtml?: string): string | null {
  const combinedText = [htmlToText(contentHtml ?? ''), htmlToText(excerptHtml ?? '')].filter(Boolean).join(' ');
  const courseNames = extractCourseNames(combinedText).slice(0, 4);

  if (courseNames.length === 0) {
    return null;
  }

  if (/electives?/i.test(title)) {
    return `${title} for CS and CE, including ${joinHumanList(courseNames)}.`;
  }

  return `${title} covering ${joinHumanList(courseNames)}.`;
}

function scoreSummaryCandidate(text: string, title: string): number {
  let score = Math.min(text.length, DEFAULT_SUMMARY_LENGTH);

  if (text.toLowerCase() === title.trim().toLowerCase()) {
    score -= 300;
  }

  if (/project\s+id|supervisor/i.test(text)) {
    score -= 140;
  }

  if (looksLikeCourseInventory(text)) {
    score -= 180;
  }

  if (/^[A-Z0-9:()\-\s]{18,}$/.test(text)) {
    score -= 90;
  }

  if (/[.!?]/.test(text)) {
    score += 40;
  }

  if (/\b(the|this|that|students|department|systems|course|project|allows|provides|helps|focuses)\b/i.test(text)) {
    score += 20;
  }

  if (text.split(/\s+/).length < 10) {
    score -= 40;
  }

  return score;
}

function truncateSummary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const boundary = text.lastIndexOf(' ', maxLength - 3);
  const cutoff = boundary > 60 ? boundary : maxLength - 3;
  return `${text.slice(0, cutoff).trim()}...`;
}

function cleanSummaryCandidate(text: string, title: string): string {
  const normalized = stripLeadingNoise(text, title)
    .replace(/^(?:["'])([a-z])/, (_, quote: string, letter: string) => `${quote}${letter.toUpperCase()}`)
    .replace(/^([a-z])/, (_, letter: string) => letter.toUpperCase());

  return normalized
    .replace(/\bhttps?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildContentSummary(input: {
  title: string;
  contentHtml?: string;
  excerptHtml?: string;
  maxLength?: number;
}): string {
  const title = input.title.trim();
  const maxLength = input.maxLength ?? DEFAULT_SUMMARY_LENGTH;
  const candidates = [
    ...extractBlocks(input.contentHtml),
    ...extractBlocks(input.excerptHtml),
    htmlToText(input.contentHtml ?? ''),
    htmlToText(input.excerptHtml ?? '')
  ]
    .map((candidate) => cleanSummaryCandidate(candidate, title))
    .filter((candidate) => isUsefulSummary(candidate, title))
    .sort((left, right) => scoreSummaryCandidate(right, title) - scoreSummaryCandidate(left, title));

  const bestCandidate = candidates[0];
  const inventorySummary = buildCourseInventorySummary(title, input.contentHtml, input.excerptHtml);

  if (!bestCandidate && inventorySummary) {
    return truncateSummary(inventorySummary, maxLength);
  }

  if (bestCandidate && looksLikeCourseInventory(bestCandidate) && inventorySummary) {
    return truncateSummary(inventorySummary, maxLength);
  }

  return truncateSummary(bestCandidate || title || 'Content summary unavailable.', maxLength);
}