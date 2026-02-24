import { NextRequest } from 'next/server';

import { toArticleDetailResponse } from '@/lib/content/transform';
import { getArticleBySlug } from '@/lib/db/queries';
import {
  getCachedApiJsonResponse,
  markApiCacheMiss,
  setCachedApiJsonResponse
} from '@/lib/internal/api-cache';
import { badRequest, internalError, jsonCached, notFound } from '@/lib/internal/http';
import { applyRateLimitHeaders, enforcePublicApiRateLimit } from '@/lib/internal/rate-limit';

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';
const CACHE_TTL_SECONDS = 60;
const CACHE_SCOPE = 'wiki-article-detail';
const RATE_LIMIT_SCOPE = 'wiki-article-detail';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  try {
    const rateLimit = await enforcePublicApiRateLimit(request, RATE_LIMIT_SCOPE);
    if (rateLimit.blockedResponse) {
      return rateLimit.blockedResponse;
    }

    const slug = (await params).slug?.trim();
    if (!slug) {
      const response = badRequest('slug is required');
      applyRateLimitHeaders(response, rateLimit.headers);
      return response;
    }

    const cachedResponse = await getCachedApiJsonResponse(request, CACHE_SCOPE, CACHE_CONTROL);
    if (cachedResponse) {
      applyRateLimitHeaders(cachedResponse, rateLimit.headers);
      return cachedResponse;
    }

    const article = await getArticleBySlug(slug);
    if (!article) {
      const response = notFound('Article not found');
      applyRateLimitHeaders(response, rateLimit.headers);
      return response;
    }

    const payload = { article: toArticleDetailResponse(article) };
    const response = jsonCached(payload, CACHE_CONTROL);
    markApiCacheMiss(response);
    applyRateLimitHeaders(response, rateLimit.headers);
    await setCachedApiJsonResponse(request, CACHE_SCOPE, payload, CACHE_TTL_SECONDS);
    return response;
  } catch {
    return internalError();
  }
}
