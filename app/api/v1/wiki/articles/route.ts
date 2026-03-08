import { NextRequest } from 'next/server';

import { toArticleListResponse } from '@/lib/content/transform';
import { listArticles, type ArticleSort } from '@/lib/db/queries';
import { parsePositiveInt } from '@/lib/api/params';
import {
  getCachedApiJsonResponse,
  markApiCacheMiss,
  setCachedApiJsonResponse
} from '@/lib/internal/api-cache';
import { badRequest, internalError, jsonCached } from '@/lib/internal/http';
import { applyRateLimitHeaders, enforcePublicApiRateLimit } from '@/lib/internal/rate-limit';

const ALLOWED_SORTS: ArticleSort[] = ['modified_desc', 'modified_asc', 'published_desc', 'published_asc'];
const CACHE_CONTROL = 'public, s-maxage=28800, stale-while-revalidate=86400';
const CACHE_TTL_SECONDS = 28800;
const CACHE_SCOPE = 'wiki-articles-list';
const RATE_LIMIT_SCOPE = 'wiki-articles-list';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const rateLimit = await enforcePublicApiRateLimit(request, RATE_LIMIT_SCOPE);
    if (rateLimit.blockedResponse) {
      return rateLimit.blockedResponse;
    }

    const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
    const pageSizeRaw = parsePositiveInt(request.nextUrl.searchParams.get('pageSize'), 20);
    const pageSize = Math.min(pageSizeRaw, 100);

    const category = request.nextUrl.searchParams.get('category')?.trim() || undefined;
    const tag = request.nextUrl.searchParams.get('tag')?.trim() || undefined;
    const sortRaw = (request.nextUrl.searchParams.get('sort') ?? 'modified_desc').trim() as ArticleSort;

    if (!ALLOWED_SORTS.includes(sortRaw)) {
      const response = badRequest(`Invalid sort. Allowed values: ${ALLOWED_SORTS.join(', ')}`);
      applyRateLimitHeaders(response, rateLimit.headers);
      return response;
    }

    const cachedResponse = await getCachedApiJsonResponse(request, CACHE_SCOPE, CACHE_CONTROL);
    if (cachedResponse) {
      applyRateLimitHeaders(cachedResponse, rateLimit.headers);
      return cachedResponse;
    }

    const data = await listArticles({
      page,
      pageSize,
      categorySlug: category,
      tagSlug: tag,
      sort: sortRaw
    });

    const payload = {
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
      totalPages: Math.ceil(data.total / data.pageSize),
      items: data.items.map(toArticleListResponse)
    };

    const response = jsonCached(payload, CACHE_CONTROL);
    markApiCacheMiss(response);
    applyRateLimitHeaders(response, rateLimit.headers);
    await setCachedApiJsonResponse(request, CACHE_SCOPE, payload, CACHE_TTL_SECONDS);

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes('positive integer')) {
      return badRequest(error.message);
    }

    return internalError();
  }
}
