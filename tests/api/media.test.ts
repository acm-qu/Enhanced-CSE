import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/media/route';

function makeRequest(url: string): NextRequest {
  return {
    nextUrl: new URL(url)
  } as unknown as NextRequest;
}

let cacheDir: string;
let previousCacheDir: string | undefined;

describe('media route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Without this the route reads the repo's real .media-cache and serves a
    // cached image instead of exercising the fetch path.
    previousCacheDir = process.env.MEDIA_CACHE_DIR;
    cacheDir = mkdtempSync(join(tmpdir(), 'media-cache-test-'));
    process.env.MEDIA_CACHE_DIR = cacheDir;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(cacheDir, { recursive: true, force: true });
    if (previousCacheDir === undefined) {
      delete process.env.MEDIA_CACHE_DIR;
    } else {
      process.env.MEDIA_CACHE_DIR = previousCacheDir;
    }
  });

  it('returns buffered image bytes for allowed source urls', async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71]);
    const fetchMock = vi.fn(async () =>
      new Response(imageBytes, {
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
          etag: '"proxy-test"'
        }
      })
    );

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const response = await GET(
      makeRequest('http://localhost/api/media?url=http%3A%2F%2Fblogs.qu.edu.qa%2Fcse%2Ffiles%2F2021%2F01%2Fimage-1.png')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-length')).toBe(String(imageBytes.byteLength));
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(imageBytes);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://blogs.qu.edu.qa/cse/files/2021/01/image-1.png',
      expect.objectContaining({ redirect: 'follow' })
    );
  });

  it('rejects unsupported source hosts', async () => {
    const response = await GET(makeRequest('http://localhost/api/media?url=https%3A%2F%2Fexample.com%2Ftest.png'));
    expect(response.status).toBe(400);
  });

  it('serves a second request from disk without calling upstream', async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10]);
    const fetchMock = vi.fn(
      async () =>
        new Response(imageBytes, {
          status: 200,
          headers: { 'content-type': 'image/png' }
        })
    );
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const url = 'http://localhost/api/media?url=http%3A%2F%2Fblogs.qu.edu.qa%2Fcse%2Ffiles%2F2021%2F01%2Fcache-me.png';

    const first = await GET(makeRequest(url));
    expect(first.status).toBe(200);
    expect(first.headers.get('x-media-cache')).toBe('MISS');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await GET(makeRequest(url));
    expect(second.status).toBe(200);
    expect(second.headers.get('x-media-cache')).toBe('HIT');
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(imageBytes);
    // The whole point: the production host cannot reach upstream, so a cached
    // asset must never trigger a second fetch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports upstream failure as not found rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNRESET');
      }) as unknown as typeof fetch
    );

    const response = await GET(
      makeRequest('http://localhost/api/media?url=http%3A%2F%2Fblogs.qu.edu.qa%2Fcse%2Ffiles%2F2021%2F01%2Fgone.png')
    );

    expect(response.status).toBe(404);
  });
});
