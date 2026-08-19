import { createHash } from 'crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'fs/promises';
import { join } from 'path';

import { log } from '@/lib/internal/log';

// Article images live on an HTTP-only host and are proxied through /api/media,
// so every image on a page is an outbound request from the app server. Pages
// here carry up to ~114 images, which saturates the small process pool on
// shared hosting. Caching each asset on disk turns that into one fetch per
// asset for the lifetime of the cache, and the semaphore keeps the number of
// simultaneous upstream connections bounded on a cold cache.

const MAX_CONCURRENT_UPSTREAM_FETCHES = 6;
const MAX_CACHED_BYTES = 12 * 1024 * 1024;

export interface CachedAsset {
  // ArrayBuffer rather than Buffer: fs.readFile yields Buffer<ArrayBufferLike>,
  // which TypeScript will not accept as a BodyInit for NextResponse.
  body: ArrayBuffer;
  contentType: string;
  etag?: string;
  lastModified?: string;
}

interface AssetMetadata {
  contentType: string;
  etag?: string;
  lastModified?: string;
}

function getCacheDir(): string {
  return process.env.MEDIA_CACHE_DIR ?? join(process.cwd(), '.media-cache');
}

declare global {
  // eslint-disable-next-line no-var
  var __mediaCacheDirState: 'ready' | 'missing' | undefined;
}

/**
 * Whether the cache directory itself is present, as opposed to a particular
 * asset being absent from it. Without this the two failures are
 * indistinguishable from a response, and "cache never shipped to the server"
 * looks identical to "this one image was never mirrored".
 *
 * Resolved once per process; the directory does not appear or vanish mid-run.
 *
 * Deliberately async: a synchronous fs call on a path Next cannot analyse
 * statically makes its output tracer fall back to copying the entire project
 * root into the standalone bundle.
 */
export async function getCacheDirState(): Promise<'ready' | 'missing'> {
  if (!global.__mediaCacheDirState) {
    global.__mediaCacheDirState = await stat(getCacheDir())
      .then((entry) => (entry.isDirectory() ? ('ready' as const) : ('missing' as const)))
      .catch(() => 'missing' as const);
  }

  return global.__mediaCacheDirState;
}

function cacheKey(sourceUrl: string): string {
  return createHash('sha256').update(sourceUrl).digest('hex');
}

export async function readCachedAsset(sourceUrl: string): Promise<CachedAsset | null> {
  const key = cacheKey(sourceUrl);
  const dir = getCacheDir();

  try {
    const [body, rawMeta] = await Promise.all([
      readFile(join(dir, `${key}.bin`)),
      readFile(join(dir, `${key}.json`), 'utf-8')
    ]);

    const meta = JSON.parse(rawMeta) as AssetMetadata;
    if (!meta.contentType) {
      return null;
    }

    return {
      body: new Uint8Array(body).buffer,
      contentType: meta.contentType,
      etag: meta.etag,
      lastModified: meta.lastModified
    };
  } catch {
    return null;
  }
}

export async function writeCachedAsset(sourceUrl: string, asset: CachedAsset): Promise<void> {
  if (asset.body.byteLength > MAX_CACHED_BYTES) {
    return;
  }

  const key = cacheKey(sourceUrl);
  const dir = getCacheDir();

  try {
    await mkdir(dir, { recursive: true });

    const meta: AssetMetadata = {
      contentType: asset.contentType,
      etag: asset.etag,
      lastModified: asset.lastModified
    };

    // Write to a unique temp name first so a concurrent reader never observes a
    // partially written asset.
    const stamp = `${process.pid}-${key.slice(0, 8)}`;
    const bodyTmp = join(dir, `.${stamp}.bin.tmp`);
    const metaTmp = join(dir, `.${stamp}.json.tmp`);

    await writeFile(bodyTmp, new Uint8Array(asset.body));
    await writeFile(metaTmp, JSON.stringify(meta));
    await rename(bodyTmp, join(dir, `${key}.bin`));
    await rename(metaTmp, join(dir, `${key}.json`));
    // mkdir above may have just created it.
    global.__mediaCacheDirState = 'ready';
  } catch (error) {
    // A read-only or full disk must not break image delivery — the asset is
    // still served, just not cached.
    log('info', 'media.cache.write_failed', {
      reason: error instanceof Error ? error.message : 'unknown'
    });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __mediaFetchQueue: Array<() => void> | undefined;
  // eslint-disable-next-line no-var
  var __mediaFetchActive: number | undefined;
  // eslint-disable-next-line no-var
  var __mediaInflight: Map<string, Promise<CachedAsset | null>> | undefined;
}

function acquireSlot(): Promise<void> {
  global.__mediaFetchQueue ??= [];
  global.__mediaFetchActive ??= 0;

  if (global.__mediaFetchActive < MAX_CONCURRENT_UPSTREAM_FETCHES) {
    global.__mediaFetchActive += 1;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    global.__mediaFetchQueue!.push(() => {
      global.__mediaFetchActive! += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  global.__mediaFetchActive = Math.max(0, (global.__mediaFetchActive ?? 1) - 1);
  const next = global.__mediaFetchQueue?.shift();
  if (next) {
    next();
  }
}

/**
 * Runs `task` with a bounded number of concurrent upstream fetches, collapsing
 * simultaneous requests for the same asset into a single fetch.
 */
export async function withUpstreamSlot(
  sourceUrl: string,
  task: () => Promise<CachedAsset | null>
): Promise<CachedAsset | null> {
  global.__mediaInflight ??= new Map();

  const existing = global.__mediaInflight.get(sourceUrl);
  if (existing) {
    return existing;
  }

  const run = (async () => {
    await acquireSlot();
    try {
      return await task();
    } finally {
      releaseSlot();
      global.__mediaInflight?.delete(sourceUrl);
    }
  })();

  global.__mediaInflight.set(sourceUrl, run);
  return run;
}
