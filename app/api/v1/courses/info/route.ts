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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function finalizeResponse(response: Response, rateLimitHeaders: Record<string, string>): Response {
  applyRateLimitHeaders(response, rateLimitHeaders);
  response.headers.set('Netlify-Vary', 'query=url');
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const rateLimit = await enforcePublicApiRateLimit(request, RATE_LIMIT_SCOPE);
    if (rateLimit.blockedResponse) {
      return finalizeResponse(rateLimit.blockedResponse, rateLimit.headers);
    }

    const rawUrl = request.nextUrl.searchParams.get('url')?.trim();
    if (!rawUrl) {
      const response = badRequest('url query parameter is required');
      return finalizeResponse(response, rateLimit.headers);
    }

    const sourceUrl = normalizeCourseInfoUrl(rawUrl);
    if (!sourceUrl) {
      const response = badRequest('Invalid course info URL');
      return finalizeResponse(response, rateLimit.headers);
    }

    const cachedResponse = await getCachedApiJsonResponse(request, CACHE_SCOPE, CACHE_CONTROL);
    if (cachedResponse) {
      return finalizeResponse(cachedResponse, rateLimit.headers);
    }

    const upstreamResponse = await fetch(sourceUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Enhanced-CSE/1.0 (+https://github.com)'
      },
      redirect: 'follow',
      cache: 'no-store'
    });

    if (upstreamResponse.status === 404) {
      const response = notFound('Course not found');
      return finalizeResponse(response, rateLimit.headers);
    }

    if (!upstreamResponse.ok) {
      log('error', 'course.info.fetch_failed', {
        url: sourceUrl,
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText
      });

      const response = NextResponse.json({ error: 'Failed to fetch course info' }, { status: 502 });
      return finalizeResponse(response, rateLimit.headers);
    }

    const html = await upstreamResponse.text();
    const course = parseCourseInfoHtml(sourceUrl, html);
    const payload = {
      course,
      fetchedAt: new Date().toISOString()
    };

    const response = jsonCached(payload, CACHE_CONTROL);
    markApiCacheMiss(response);
    finalizeResponse(response, rateLimit.headers);
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
