import { NextRequest } from 'next/server';

import { getSyncMeta } from '@/lib/db/queries';
import {
  getCachedApiJsonResponse,
  markApiCacheMiss,
  setCachedApiJsonResponse
} from '@/lib/internal/api-cache';
import { internalError, jsonCached } from '@/lib/internal/http';
import { applyRateLimitHeaders, enforcePublicApiRateLimit } from '@/lib/internal/rate-limit';

const CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=120';
const CACHE_TTL_SECONDS = 30;
const CACHE_SCOPE = 'wiki-meta';
const RATE_LIMIT_SCOPE = 'wiki-meta';

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

    const meta = await getSyncMeta();
    const payload = {
      hasTags: meta.hasTags,
      lastSuccessAt: meta.lastSuccessAt?.toISOString() ?? null,
      lastRunStatus: meta.lastRunStatus
    };

    const response = jsonCached(payload, CACHE_CONTROL);
    markApiCacheMiss(response);
    applyRateLimitHeaders(response, rateLimit.headers);
    await setCachedApiJsonResponse(request, CACHE_SCOPE, payload, CACHE_TTL_SECONDS);
    return response;
  } catch {
    return internalError();
  }
}
