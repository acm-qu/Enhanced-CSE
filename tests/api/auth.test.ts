import type { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { isCronRequestAuthorized, isSyncRequestAuthorized } from '@/lib/internal/auth';

function makeRequest(url: string, headers?: Record<string, string>): NextRequest {
  return {
    headers: new Headers(headers),
    nextUrl: new URL(url)
  } as unknown as NextRequest;
}

describe('internal auth helpers', () => {
  it('authorizes sync request with x-sync-secret', () => {
    const request = makeRequest('http://localhost/api/internal/sync/run', {
      'x-sync-secret': 'abc123'
    });

    expect(isSyncRequestAuthorized(request, 'abc123')).toBe(true);
    expect(isSyncRequestAuthorized(request, 'wrong')).toBe(false);
  });

  it('authorizes cron request with bearer token', () => {
    const request = makeRequest('http://localhost/api/internal/sync/cron', {
      authorization: 'Bearer cron-secret'
    });

    expect(isCronRequestAuthorized(request, 'cron-secret')).toBe(true);
  });

  it('authorizes cron request with query secret fallback', () => {
    const request = makeRequest('http://localhost/api/internal/sync/cron?secret=cron-secret');
    expect(isCronRequestAuthorized(request, 'cron-secret')).toBe(true);
  });
});
