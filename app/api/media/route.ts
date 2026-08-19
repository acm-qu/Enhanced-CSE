import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isImageContentType, resolveSourceAssetUrl } from '@/lib/content/asset-proxy';
import {
  getCacheDirState,
  readCachedAsset,
  withUpstreamSlot,
  writeCachedAsset,
  type CachedAsset
} from '@/lib/content/media-cache';
import { badRequest, notFound } from '@/lib/internal/http';

const MEDIA_CACHE_CONTROL = 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800';
const UPSTREAM_TIMEOUT_MS = 15_000;
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

class UpstreamError extends Error {
  constructor(readonly kind: 'unreachable' | 'not-found' | 'bad-gateway' | 'unsupported-type' | 'empty') {
    super(kind);
  }
}

async function fetchUpstreamAsset(sourceUrl: URL): Promise<CachedAsset> {
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(sourceUrl.toString(), {
      headers: {
        Accept: 'image/*,*/*;q=0.8'
      },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
  } catch {
    throw new UpstreamError('unreachable');
  }

  if (!upstreamResponse.ok) {
    throw new UpstreamError(upstreamResponse.status === 404 ? 'not-found' : 'bad-gateway');
  }

  const contentType = resolveImageContentType(sourceUrl, upstreamResponse.headers.get('content-type'));
  if (!contentType) {
    throw new UpstreamError('unsupported-type');
  }

  const body = await upstreamResponse.arrayBuffer();
  if (body.byteLength === 0) {
    throw new UpstreamError('empty');
  }

  return {
    body,
    contentType,
    etag: upstreamResponse.headers.get('etag') ?? undefined,
    lastModified: upstreamResponse.headers.get('last-modified') ?? undefined
  };
}

/**
 * Stamped on every response, success or failure. `X-Media-Cache-Dir: missing`
 * means the cache directory was never found — i.e. it was not shipped to the
 * server, or landed outside the app root — which is otherwise indistinguishable
 * from a single un-mirrored image.
 */
async function withCacheDiagnostics<T extends NextResponse>(response: T): Promise<T> {
  response.headers.set('X-Media-Cache-Dir', await getCacheDirState());
  return response;
}

function buildResponse(asset: CachedAsset, cacheStatus: 'HIT' | 'MISS'): NextResponse {
  const response = new NextResponse(asset.body, { status: 200 });

  response.headers.set('Cache-Control', MEDIA_CACHE_CONTROL);
  response.headers.set('Netlify-Vary', 'query=url');
  response.headers.set('Content-Type', asset.contentType);
  response.headers.set('Content-Length', String(asset.body.byteLength));
  response.headers.set('Content-Disposition', 'inline');
  response.headers.set('X-Media-Cache', cacheStatus);

  if (asset.etag) {
    response.headers.set('ETag', asset.etag);
  }

  if (asset.lastModified) {
    response.headers.set('Last-Modified', asset.lastModified);
  }

  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawUrl = request.nextUrl.searchParams.get('url');
  const sourceUrl = rawUrl ? resolveSourceAssetUrl(rawUrl) : null;

  if (!sourceUrl) {
    return badRequest('Unsupported media URL');
  }

  const key = sourceUrl.toString();

  const cached = await readCachedAsset(key);
  if (cached) {
    return await withCacheDiagnostics(buildResponse(cached, 'HIT'));
  }

  try {
    // Bounded concurrency + single-flight: a page with 100+ images issues one
    // upstream fetch per distinct asset, at most a handful at a time.
    const asset = await withUpstreamSlot(key, async () => {
      const revalidated = await readCachedAsset(key);
      if (revalidated) {
        return revalidated;
      }

      const fetched = await fetchUpstreamAsset(sourceUrl);
      await writeCachedAsset(key, fetched);
      return fetched;
    });

    if (!asset) {
      return await withCacheDiagnostics(notFound('Media asset not reachable'));
    }

    return await withCacheDiagnostics(buildResponse(asset, 'MISS'));
  } catch (error) {
    if (error instanceof UpstreamError) {
      switch (error.kind) {
        case 'not-found':
          return await withCacheDiagnostics(notFound('Media asset not found'));
        case 'empty':
          return await withCacheDiagnostics(notFound('Media asset is empty'));
        case 'unsupported-type':
          return await withCacheDiagnostics(badRequest('Unsupported media type'));
        case 'bad-gateway':
          return await withCacheDiagnostics(
            NextResponse.json({ error: 'Failed to fetch media asset' }, { status: 502 })
          );
        default:
          return await withCacheDiagnostics(notFound('Media asset not reachable'));
      }
    }

    return await withCacheDiagnostics(notFound('Media asset not reachable'));
  }
}
