#!/usr/bin/env node
/**
 * Pre-populates the /api/media disk cache.
 *
 * The production host cannot reach blogs.qu.edu.qa (the image host resets the
 * connection for its IP), so article images cannot be fetched on demand. This
 * script runs from a machine that CAN reach it, downloads every image
 * referenced by synced content, and writes the exact on-disk format that
 * lib/content/media-cache.ts reads. Rsync the resulting directory to the server
 * and the media route serves every image from cache without any outbound call.
 *
 *   DATABASE_URL=... node scripts/mirror-media.mjs
 *   rsync -av .media-cache/ user@host:~/csewiki/.media-cache/
 *
 * Re-run after a content sync to pick up new images; existing entries are
 * skipped, so it only downloads the delta.
 */

import { createHash } from 'crypto';
import { mkdir, readdir, writeFile } from 'fs/promises';
import { join } from 'path';

import postgres from 'postgres';

const SOURCE_HOST = 'blogs.qu.edu.qa';
const CACHE_DIR = process.env.MEDIA_CACHE_DIR ?? join(process.cwd(), '.media-cache');
const CONCURRENCY = 8;
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 12 * 1024 * 1024;

const IMAGE_CONTENT_TYPES = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function resolveContentType(url, header) {
  const normalized = (header ?? '').split(';')[0].trim().toLowerCase();
  if (normalized.startsWith('image/')) {
    return normalized;
  }

  const pathname = url.pathname.toLowerCase();
  for (const [ext, type] of Object.entries(IMAGE_CONTENT_TYPES)) {
    if (pathname.endsWith(ext)) {
      return type;
    }
  }

  return null;
}

/**
 * Must produce the same string the route hashes, which is
 * resolveSourceAssetUrl(raw).toString() — a parsed, normalised URL on the
 * source host. Anything else silently produces cache entries that never hit.
 */
function normalizeSourceUrl(raw) {
  const value = raw.trim();
  if (!value) return null;

  let parsed;
  try {
    if (value.startsWith('//')) {
      parsed = new URL(`https:${value}`);
    } else if (value.startsWith('/')) {
      parsed = new URL(value, `https://${SOURCE_HOST}`);
    } else if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
      parsed = new URL(value.startsWith('cse/') ? `/${value}` : value, `https://${SOURCE_HOST}`);
    } else {
      parsed = new URL(value);
    }
  } catch {
    return null;
  }

  if (parsed.hostname.toLowerCase() !== SOURCE_HOST) return null;
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  return parsed;
}

async function collectImageUrls(sql) {
  const urls = new Map();

  for (const table of ['wiki_articles', 'blog_posts']) {
    let rows;
    try {
      rows = await sql`select content_html_raw, excerpt_html_raw from ${sql(table)}`;
    } catch (error) {
      console.warn(`skipping ${table}: ${error.message}`);
      continue;
    }

    for (const row of rows) {
      const html = `${row.content_html_raw ?? ''}\n${row.excerpt_html_raw ?? ''}`;

      for (const match of html.matchAll(/(?:src|srcset)\s*=\s*"([^"]+)"/gi)) {
        for (const candidate of match[1].split(',')) {
          const raw = candidate.trim().split(/\s+/)[0];
          if (!raw) continue;
          if (!/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(raw)) continue;

          const parsed = normalizeSourceUrl(raw);
          if (parsed) {
            urls.set(parsed.toString(), parsed);
          }
        }
      }
    }

    console.log(`scanned ${rows.length} rows in ${table}`);
  }

  return [...urls.values()];
}

async function download(url) {
  const response = await fetch(url.toString(), {
    headers: { Accept: 'image/*,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = resolveContentType(url, response.headers.get('content-type'));
  if (!contentType) {
    throw new Error('not an image');
  }

  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength === 0) throw new Error('empty body');
  if (body.byteLength > MAX_BYTES) throw new Error(`too large (${body.byteLength})`);

  return {
    body,
    contentType,
    etag: response.headers.get('etag') ?? undefined,
    lastModified: response.headers.get('last-modified') ?? undefined
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require' });
  const urls = await collectImageUrls(sql);
  await sql.end();

  console.log(`\n${urls.length} distinct images referenced`);

  await mkdir(CACHE_DIR, { recursive: true });
  const existing = new Set(await readdir(CACHE_DIR).catch(() => []));

  const pending = urls.filter((url) => {
    const key = createHash('sha256').update(url.toString()).digest('hex');
    return !(existing.has(`${key}.bin`) && existing.has(`${key}.json`));
  });

  console.log(`${urls.length - pending.length} already cached, ${pending.length} to download\n`);

  let done = 0;
  let failed = 0;
  let bytes = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < pending.length) {
      const url = pending[cursor++];
      const key = createHash('sha256').update(url.toString()).digest('hex');

      try {
        const asset = await download(url);
        await writeFile(join(CACHE_DIR, `${key}.bin`), asset.body);
        await writeFile(
          join(CACHE_DIR, `${key}.json`),
          JSON.stringify({
            contentType: asset.contentType,
            etag: asset.etag,
            lastModified: asset.lastModified
          })
        );

        bytes += asset.body.byteLength;
        done += 1;
      } catch (error) {
        failed += 1;
        console.warn(`  FAIL ${url.pathname} — ${error.message}`);
      }

      const processed = done + failed;
      if (processed % 50 === 0 || processed === pending.length) {
        console.log(`  ${processed}/${pending.length}  (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\ncached ${done}, failed ${failed}, ${(bytes / 1024 / 1024).toFixed(1)} MB in ${CACHE_DIR}`);

  if (failed > 0) {
    console.log('Failures are images that no longer exist upstream; they will 404 as before.');
  }
}

await main();
