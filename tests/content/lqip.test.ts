import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sanitizeWikiHtml } from '@/lib/content/html';
import { resetLqipManifestForTests } from '@/lib/content/lqip';

const SOURCE = 'http://blogs.qu.edu.qa/cse/files/2021/01/image-1.png';
// A one-pixel WebP is enough; only the shape of the data URI matters here.
const PLACEHOLDER = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAA==';

let cacheDir: string;
let previous: string | undefined;

describe('low-quality image placeholders', () => {
  beforeEach(() => {
    previous = process.env.MEDIA_CACHE_DIR;
    cacheDir = mkdtempSync(join(tmpdir(), 'lqip-test-'));
    process.env.MEDIA_CACHE_DIR = cacheDir;
    resetLqipManifestForTests();
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
    if (previous === undefined) {
      delete process.env.MEDIA_CACHE_DIR;
    } else {
      process.env.MEDIA_CACHE_DIR = previous;
    }
    resetLqipManifestForTests();
  });

  function writeManifest(entries: Record<string, string>): void {
    writeFileSync(join(cacheDir, 'lqip.json'), JSON.stringify(entries));
  }

  it('inlines the placeholder as a background while src stays the real image', () => {
    writeManifest({ [SOURCE]: PLACEHOLDER });

    const sanitized = sanitizeWikiHtml(`<img src="${SOURCE}" alt="x">`);

    expect(sanitized).toContain(`background-image:url("${PLACEHOLDER}")`);
    // src must remain the proxied image so no-JS clients and crawlers still
    // load it — the placeholder is purely decorative behind it.
    expect(sanitized).toContain('src="/api/media?url=');
    expect(sanitized).not.toContain(`src="${PLACEHOLDER}"`);
  });

  it('renders normally when the image has no placeholder', () => {
    writeManifest({});

    const sanitized = sanitizeWikiHtml(`<img src="${SOURCE}" alt="x">`);

    expect(sanitized).toContain('src="/api/media?url=');
    expect(sanitized).not.toContain('background-image');
  });

  it('degrades quietly when the manifest is missing entirely', () => {
    const sanitized = sanitizeWikiHtml(`<img src="${SOURCE}" alt="x">`);

    expect(sanitized).toContain('src="/api/media?url=');
    expect(sanitized).not.toContain('background-image');
  });

  it('drops styles supplied by the upstream HTML', () => {
    writeManifest({ [SOURCE]: PLACEHOLDER });

    const sanitized = sanitizeWikiHtml(
      `<img src="${SOURCE}" style="background-image:url('https://evil.example/x.png');position:fixed" alt="x">`
    );

    expect(sanitized).not.toContain('evil.example');
    expect(sanitized).not.toContain('position:fixed');
    expect(sanitized).toContain(`background-image:url("${PLACEHOLDER}")`);
  });

  it('preserves the sizes attribute WordPress emits', () => {
    // Without sizes, browsers assume 100vw and pick the largest srcset entry.
    const html =
      `<img src="${SOURCE}" srcset="${SOURCE} 2560w" sizes="(max-width: 2560px) 100vw, 2560px" alt="x">`;
    const sanitized = sanitizeWikiHtml(html);

    expect(sanitized).toContain('sizes="(max-width: 2560px) 100vw, 2560px"');
  });
});
