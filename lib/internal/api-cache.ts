import { NextRequest, NextResponse } from 'next/server';

import { log } from '@/lib/internal/log';
import { getRedisClient } from '@/lib/internal/redis';

const CACHE_PREFIX = 'enhanced-cse:api-cache:v1';

interface CachedJsonValue {
  status: number;
  body: unknown;
}

function normalizeSearchParams(searchParams: URLSearchParams): string {
  const normalized = Array.from(searchParams.entries()).sort(([aKey, aValue], [bKey, bValue]) => {
    if (aKey === bKey) {
      return aValue.localeCompare(bValue);
    }

    return aKey.localeCompare(bKey);
  });

  if (normalized.length === 0) {
    return '';
  }

  return normalized.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}

export function buildApiCacheKey(request: NextRequest, scope: string): string {
  const normalizedQuery = normalizeSearchParams(request.nextUrl.searchParams);
  const routeKey = normalizedQuery ? `${request.nextUrl.pathname}?${normalizedQuery}` : request.nextUrl.pathname;
  return `${CACHE_PREFIX}:${scope}:${routeKey}`;
}

export function markApiCacheMiss(response: Response): void {
  response.headers.set('X-Cache', 'MISS');
}

export async function getCachedApiJsonResponse(
  request: NextRequest,
  scope: string,
  cacheControl: string
): Promise<NextResponse | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const key = buildApiCacheKey(request, scope);
    const cached = await redis.get<CachedJsonValue>(key);
    if (!cached || typeof cached !== 'object') {
      return null;
    }

    const status = typeof cached.status === 'number' ? cached.status : 200;
    const response = NextResponse.json(cached.body, { status });
    response.headers.set('Cache-Control', cacheControl);
    response.headers.set('X-Cache', 'HIT');
    return response;
  } catch (error) {
    log('error', 'upstash.cache.read_error', {
      scope,
      path: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export async function setCachedApiJsonResponse(
  request: NextRequest,
  scope: string,
  body: unknown,
  ttlSeconds: number,
  status = 200
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const key = buildApiCacheKey(request, scope);
    await redis.set(
      key,
      {
        status,
        body
      } satisfies CachedJsonValue,
      {
        ex: ttlSeconds
      }
    );
  } catch (error) {
    log('error', 'upstash.cache.write_error', {
      scope,
      path: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function invalidateApiCache(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const keys = await redis.keys(`${CACHE_PREFIX}:*`);
    if (!Array.isArray(keys) || keys.length === 0) {
      return;
    }

    await redis.del(...keys);
    log('info', 'upstash.cache.invalidated', { keys_deleted: keys.length });
  } catch (error) {
    log('error', 'upstash.cache.invalidate_error', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
