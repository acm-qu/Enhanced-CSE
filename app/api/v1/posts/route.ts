import { NextRequest } from 'next/server';

import { toPostListResponse } from '@/lib/content/transform';
import { listPosts, type PostSort } from '@/lib/db/posts-queries';
import { parsePositiveInt } from '@/lib/api/params';
import { badRequest, internalError, jsonCached } from '@/lib/internal/http';

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';
const ALLOWED_SORTS: PostSort[] = ['published_desc', 'published_asc', 'modified_desc', 'modified_asc'];
const MONTH_FORMAT_RE = /^\d{4}-\d{2}$/;

function parseIsoDate(raw: string | null, fieldName: 'after' | 'before'): Date | undefined {
  if (!raw) {
    return undefined;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date`);
  }

  return parsed;
}

function parseMonth(raw: string | null): string | undefined {
  if (!raw) {
    return undefined;
  }

  if (!MONTH_FORMAT_RE.test(raw)) {
    throw new Error('month must be in YYYY-MM format');
  }

  const [yearRaw, monthRaw] = raw.split('-');
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error('month must be in YYYY-MM format');
  }

  return `${String(year)}-${String(monthNumber).padStart(2, '0')}`;
}

function resolveMonthBounds(month: string): { after: Date; before: Date } {
  const [yearRaw, monthRaw] = month.split('-');
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);

  return {
    after: new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0)),
    before: new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999))
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
    const pageSizeRaw = parsePositiveInt(request.nextUrl.searchParams.get('pageSize'), 20);
    const pageSize = Math.min(pageSizeRaw, 100);

    const category = request.nextUrl.searchParams.get('category')?.trim() || undefined;
    const sortRaw = (request.nextUrl.searchParams.get('sort') ?? 'published_desc').trim() as PostSort;

    if (!ALLOWED_SORTS.includes(sortRaw)) {
      return badRequest(`Invalid sort. Allowed values: ${ALLOWED_SORTS.join(', ')}`);
    }

    const month = parseMonth(request.nextUrl.searchParams.get('month'));
    const afterRaw = request.nextUrl.searchParams.get('after');
    const beforeRaw = request.nextUrl.searchParams.get('before');

    if (month && (afterRaw || beforeRaw)) {
      return badRequest('month cannot be combined with after/before');
    }

    let after = parseIsoDate(afterRaw, 'after');
    let before = parseIsoDate(beforeRaw, 'before');

    if (month) {
      const monthBounds = resolveMonthBounds(month);
      after = monthBounds.after;
      before = monthBounds.before;
    }

    if (after && before && after > before) {
      return badRequest('after must be less than or equal to before');
    }

    const data = await listPosts({
      page,
      pageSize,
      categorySlug: category,
      after,
      before,
      sort: sortRaw
    });

    return jsonCached({
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
      totalPages: Math.ceil(data.total / data.pageSize),
      filters: {
        category: category ?? null,
        sort: sortRaw,
        month: month ?? null,
        after: after?.toISOString() ?? null,
        before: before?.toISOString() ?? null
      },
      items: data.items.map(toPostListResponse)
    }, CACHE_CONTROL);
  } catch (error) {
    if (error instanceof Error) {
      return badRequest(error.message);
    }

    return internalError();
  }
}
