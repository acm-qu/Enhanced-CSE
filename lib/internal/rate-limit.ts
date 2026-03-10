import { Ratelimit } from '@upstash/ratelimit';
import { NextRequest, NextResponse } from 'next/server';

import { getOptionalEnv } from '@/lib/internal/env';
import { log } from '@/lib/internal/log';
import { getRedisClient } from '@/lib/internal/redis';

declare global {
  // eslint-disable-next-line no-var
  var __publicApiRateLimiter: Ratelimit | undefined;
}

const DEFAULT_PUBLIC_API_LIMIT = 120;
const DEFAULT_PUBLIC_API_WINDOW_SECONDS = 60;

function parsePositiveIntEnv(name: string, fallback: number): number {
  const value = getOptionalEnv(name);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getPublicApiRateLimiter(): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  if (!global.__publicApiRateLimiter) {
    const limit = parsePositiveIntEnv('PUBLIC_API_RATE_LIMIT_REQUESTS', DEFAULT_PUBLIC_API_LIMIT);
    const windowSeconds = parsePositiveIntEnv('PUBLIC_API_RATE_LIMIT_WINDOW_SECONDS', DEFAULT_PUBLIC_API_WINDOW_SECONDS);

    global.__publicApiRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      analytics: true,
      prefix: 'enhanced-cse:public-api:ratelimit'
    });
  }

  return global.__publicApiRateLimiter;
}

function getRequestClientIp(request: NextRequest): string {
  const candidates = [
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
    request.headers.get('x-nf-client-connection-ip'),
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-client-ip')
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const firstIp = candidate.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return 'unknown';
}

export interface RateLimitCheckResult {
  blockedResponse: NextResponse | null;
  headers: Record<string, string>;
}

export function applyRateLimitHeaders(response: Response, headers: Record<string, string>): void {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}

export async function enforcePublicApiRateLimit(
  request: NextRequest,
  scope: string
): Promise<RateLimitCheckResult> {
  const limiter = getPublicApiRateLimiter();
  if (!limiter) {
    return {
      blockedResponse: null,
      headers: {}
    };
  }

  try {
    const identifier = `${scope}:${getRequestClientIp(request)}`;
    const result = await limiter.limit(identifier);

    const headers = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
      'X-RateLimit-Reset': String(result.reset)
    };

    if (result.success) {
      return {
        blockedResponse: null,
        headers
      };
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    const response = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    applyRateLimitHeaders(response, headers);
    response.headers.set('Retry-After', String(retryAfterSeconds));

    return {
      blockedResponse: response,
      headers
    };
  } catch (error) {
    log('error', 'upstash.ratelimit.error', {
      scope,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      blockedResponse: null,
      headers: {}
    };
  }
}
