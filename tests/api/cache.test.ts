import type { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { buildApiCacheKey } from '@/lib/internal/api-cache';

function makeRequest(url: string): NextRequest {
  return {
    nextUrl: new URL(url)
  } as unknown as NextRequest;
}

describe('api cache key', () => {
  it('normalizes query parameter ordering', () => {
    const a = buildApiCacheKey(
      makeRequest('http://localhost/api/v1/wiki/articles?page=2&sort=modified_desc&category=guides'),
      'wiki-articles-list'
    );
    const b = buildApiCacheKey(
      makeRequest('http://localhost/api/v1/wiki/articles?category=guides&sort=modified_desc&page=2'),
      'wiki-articles-list'
    );

    expect(a).toBe(b);
  });

  it('keeps duplicate query keys deterministic', () => {
    const key = buildApiCacheKey(
      makeRequest('http://localhost/api/v1/wiki/articles?tag=ai&tag=ml&category=guides'),
      'wiki-articles-list'
    );

    expect(key).toContain('category=guides');
    expect(key).toContain('tag=ai');
    expect(key).toContain('tag=ml');
  });
});
