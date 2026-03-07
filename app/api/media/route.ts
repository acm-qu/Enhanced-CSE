import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isImageContentType, resolveSourceAssetUrl } from '@/lib/content/asset-proxy';
import { badRequest, notFound } from '@/lib/internal/http';

const MEDIA_CACHE_CONTROL = 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800';
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function resolveImageContentType(sourceUrl: URL, headerValue: string | null): string | null {
  const normalizedHeader = (headerValue ?? '').split(';')[0].trim().toLowerCase();
  if (isImageContentType(normalizedHeader)) {
    return normalizedHeader;
  }

  if (normalizedHeader && normalizedHeader !== 'application/octet-stream') {
    return null;
  }

  const pathname = sourceUrl.pathname.toLowerCase();
  for (const [extension, contentType] of Object.entries(IMAGE_CONTENT_TYPES)) {
    if (pathname.endsWith(extension)) {
      return contentType;
    }
  }

  return null;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawUrl = request.nextUrl.searchParams.get('url');
  const sourceUrl = rawUrl ? resolveSourceAssetUrl(rawUrl) : null;

  if (!sourceUrl) {
    return badRequest('Unsupported media URL');
  }

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(sourceUrl.toString(), {
      headers: {
        Accept: 'image/*,*/*;q=0.8'
      },
      redirect: 'follow'
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

  const contentType = resolveImageContentType(sourceUrl, upstreamResponse.headers.get('content-type'));
  if (!contentType) {
    return badRequest('Unsupported media type');
  }

  const body = Buffer.from(await upstreamResponse.arrayBuffer());
  if (body.byteLength === 0) {
    return notFound('Media asset is empty');
  }

  const response = new NextResponse(body, {
    status: 200
  });

  response.headers.set('Cache-Control', MEDIA_CACHE_CONTROL);
  response.headers.set('Content-Type', contentType);
  response.headers.set('Content-Length', String(body.byteLength));
  response.headers.set('Content-Disposition', 'inline');

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
