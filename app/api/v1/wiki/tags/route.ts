import { NextRequest } from 'next/server';

import { listTags } from '@/lib/db/queries';
import {
  getCachedApiJsonResponse,
  markApiCacheMiss,
  setCachedApiJsonResponse
} from '@/lib/internal/api-cache';
import { internalError, jsonCached } from '@/lib/internal/http';
import { applyRateLimitHeaders, enforcePublicApiRateLimit } from '@/lib/internal/rate-limit';

const CACHE_CONTROL = 'public, s-maxage=28800, stale-while-revalidate=86400';
const CACHE_TTL_SECONDS = 28800;
const CACHE_SCOPE = 'wiki-tags';
const RATE_LIMIT_SCOPE = 'wiki-tags';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const rateLimit = await enforcePublicApiRateLimit(request, RATE_LIMIT_SCOPE);
    if (rateLimit.blockedResponse) {
      return rateLimit.blockedResponse;
    }

    const cachedResponse = await getCachedApiJsonResponse(request, CACHE_SCOPE, CACHE_CONTROL);
    if (cachedResponse) {
      applyRateLimitHeaders(cachedResponse, rateLimit.headers);
      return cachedResponse;
    }

    const tags = await listTags();
    const payload = { tags };
    const response = jsonCached(payload, CACHE_CONTROL);
    markApiCacheMiss(response);
    applyRateLimitHeaders(response, rateLimit.headers);
    await setCachedApiJsonResponse(request, CACHE_SCOPE, payload, CACHE_TTL_SECONDS);
    return response;
  } catch {
    return internalError();
  }
}
