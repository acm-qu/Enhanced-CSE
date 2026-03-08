import { NextRequest, NextResponse } from 'next/server';

import { parseCourseInfoHtml } from '@/lib/content/course-info';
import {
  getCachedApiJsonResponse,
  markApiCacheMiss,
  setCachedApiJsonResponse
} from '@/lib/internal/api-cache';
import { applyRateLimitHeaders, enforcePublicApiRateLimit } from '@/lib/internal/rate-limit';
import { badRequest, internalError, jsonCached, notFound } from '@/lib/internal/http';
import { log } from '@/lib/internal/log';
import { normalizeCourseInfoUrl } from '@/lib/utils/course-info-url';

const CACHE_CONTROL = 'public, s-maxage=43200, stale-while-revalidate=86400';
const CACHE_TTL_SECONDS = 43200;
const CACHE_SCOPE = 'courses-info';
const RATE_LIMIT_SCOPE = 'courses-info';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const rateLimit = await enforcePublicApiRateLimit(request, RATE_LIMIT_SCOPE);
    if (rateLimit.blockedResponse) {
      return rateLimit.blockedResponse;
    }

    const rawUrl = request.nextUrl.searchParams.get('url')?.trim();
    if (!rawUrl) {
      const response = badRequest('url query parameter is required');
      applyRateLimitHeaders(response, rateLimit.headers);
      return response;
    }

    const sourceUrl = normalizeCourseInfoUrl(rawUrl);
    if (!sourceUrl) {
      const response = badRequest('Invalid course info URL');
      applyRateLimitHeaders(response, rateLimit.headers);
      return response;
    }

    const cachedResponse = await getCachedApiJsonResponse(request, CACHE_SCOPE, CACHE_CONTROL);
    if (cachedResponse) {
      applyRateLimitHeaders(cachedResponse, rateLimit.headers);
      return cachedResponse;
    }

    const upstreamResponse = await fetch(sourceUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Enhanced-CSE/1.0 (+https://github.com)'
      },
      redirect: 'follow'
    });

    if (upstreamResponse.status === 404) {
      const response = notFound('Course not found');
      applyRateLimitHeaders(response, rateLimit.headers);
      return response;
    }

    if (!upstreamResponse.ok) {
      log('error', 'course.info.fetch_failed', {
        url: sourceUrl,
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText
      });

      const response = NextResponse.json({ error: 'Failed to fetch course info' }, { status: 502 });
      applyRateLimitHeaders(response, rateLimit.headers);
      return response;
    }

    const html = await upstreamResponse.text();
    const course = parseCourseInfoHtml(sourceUrl, html);
    const payload = {
      course,
      fetchedAt: new Date().toISOString()
    };

    const response = jsonCached(payload, CACHE_CONTROL);
    markApiCacheMiss(response);
    applyRateLimitHeaders(response, rateLimit.headers);
    await setCachedApiJsonResponse(request, CACHE_SCOPE, payload, CACHE_TTL_SECONDS);

    return response;
  } catch (error) {
    log('error', 'course.info.unhandled_error', {
      error: error instanceof Error ? error.message : String(error),
      path: request.nextUrl.pathname
    });

    return internalError('Failed to load course details');
  }
}
