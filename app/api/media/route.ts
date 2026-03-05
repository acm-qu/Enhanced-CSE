import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isImageContentType, resolveSourceAssetUrl } from '@/lib/content/asset-proxy';
import { badRequest, notFound } from '@/lib/internal/http';

const MEDIA_CACHE_CONTROL = 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawUrl = request.nextUrl.searchParams.get('url');
  const sourceUrl = rawUrl ? resolveSourceAssetUrl(rawUrl) : null;

  if (!sourceUrl) {
    return badRequest('Unsupported media URL');
  }

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(sourceUrl, {
      headers: {
        Accept: 'image/*,*/*;q=0.8'
      },
      next: {
        revalidate: 60 * 60 * 24
      }
    });
  } catch {
    return notFound('Media asset not reachable');
  }

  if (!upstreamResponse.ok) {
    if (upstreamResponse.status === 404) {
      return notFound('Media asset not found');
    }

    return NextResponse.json({ error: 'Failed to fetch media asset' }, { status: 502 });
  }

  const contentType = upstreamResponse.headers.get('content-type');
  if (!isImageContentType(contentType)) {
    return badRequest('Unsupported media type');
  }

  if (!upstreamResponse.body) {
    return notFound('Media asset is empty');
  }

  const response = new NextResponse(upstreamResponse.body, {
    status: 200
  });

  response.headers.set('Cache-Control', MEDIA_CACHE_CONTROL);
  response.headers.set('Content-Type', contentType ?? 'application/octet-stream');

  const contentLength = upstreamResponse.headers.get('content-length');
  if (contentLength) {
    response.headers.set('Content-Length', contentLength);
  }

  const etag = upstreamResponse.headers.get('etag');
  if (etag) {
    response.headers.set('ETag', etag);
  }

  const lastModified = upstreamResponse.headers.get('last-modified');
  if (lastModified) {
    response.headers.set('Last-Modified', lastModified);
  }

  return response;
}
