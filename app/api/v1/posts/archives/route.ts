import { NextRequest } from 'next/server';

import { listPostArchives } from '@/lib/db/posts-queries';
import {
  getCachedApiJsonResponse,
  markApiCacheMiss,
  setCachedApiJsonResponse
} from '@/lib/internal/api-cache';
import { internalError, jsonCached } from '@/lib/internal/http';
import { applyRateLimitHeaders, enforcePublicApiRateLimit } from '@/lib/internal/rate-limit';

const CACHE_CONTROL = 'public, s-maxage=28800, stale-while-revalidate=86400';
const CACHE_TTL_SECONDS = 28800;
const CACHE_SCOPE = 'posts-archives';
const RATE_LIMIT_SCOPE = 'posts-archives';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const rateLimit = await enforcePublicApiRateLimit(request, RATE_LIMIT_SCOPE);
    if (rateLimit.blockedResponse) {
      return rateLimit.blockedResponse;
    }

    const category = request.nextUrl.searchParams.get('category')?.trim() || undefined;
    const cachedResponse = await getCachedApiJsonResponse(request, CACHE_SCOPE, CACHE_CONTROL);
    if (cachedResponse) {
      applyRateLimitHeaders(cachedResponse, rateLimit.headers);
      return cachedResponse;
    }

    const archives = await listPostArchives({ categorySlug: category });
    const payload = { category: category ?? null, archives };
    const response = jsonCached(payload, CACHE_CONTROL);
    markApiCacheMiss(response);
    applyRateLimitHeaders(response, rateLimit.headers);
    await setCachedApiJsonResponse(request, CACHE_SCOPE, payload, CACHE_TTL_SECONDS);
    return response;
  } catch {
    return internalError();
  }
}
