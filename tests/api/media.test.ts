import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/media/route';

function makeRequest(url: string): NextRequest {
  return {
    nextUrl: new URL(url)
  } as unknown as NextRequest;
}

describe('media route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
