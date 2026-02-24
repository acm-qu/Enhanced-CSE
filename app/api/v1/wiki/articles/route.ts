import { NextRequest } from 'next/server';

import { toArticleListResponse } from '@/lib/content/transform';
import { listArticles, type ArticleSort } from '@/lib/db/queries';
import { parsePositiveInt } from '@/lib/api/params';
import { badRequest, internalError, jsonCached } from '@/lib/internal/http';

const ALLOWED_SORTS: ArticleSort[] = ['modified_desc', 'modified_asc', 'published_desc', 'published_asc'];
const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
    const pageSizeRaw = parsePositiveInt(request.nextUrl.searchParams.get('pageSize'), 20);
    const pageSize = Math.min(pageSizeRaw, 100);

    const category = request.nextUrl.searchParams.get('category')?.trim() || undefined;
    const tag = request.nextUrl.searchParams.get('tag')?.trim() || undefined;
    const sortRaw = (request.nextUrl.searchParams.get('sort') ?? 'modified_desc').trim() as ArticleSort;

    if (!ALLOWED_SORTS.includes(sortRaw)) {
      return badRequest(`Invalid sort. Allowed values: ${ALLOWED_SORTS.join(', ')}`);
    }

    const data = await listArticles({
      page,
      pageSize,
      categorySlug: category,
      tagSlug: tag,
      sort: sortRaw
    });

    return jsonCached({
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
      totalPages: Math.ceil(data.total / data.pageSize),
      items: data.items.map(toArticleListResponse)
    }, CACHE_CONTROL);
  } catch (error) {
    if (error instanceof Error && error.message.includes('positive integer')) {
      return badRequest(error.message);
    }

    return internalError();
  }
}
