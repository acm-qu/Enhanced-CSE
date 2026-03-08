import { describe, expect, it } from 'vitest';

import { decodeFetchedHtml } from '@/lib/sync/entities';

describe('decodeFetchedHtml', () => {
  it('decodes named entities in fetched html', () => {
    expect(decodeFetchedHtml('<p>R&amp;D &ldquo;Track&rdquo; &nbsp; Program</p>')).toBe(
      '<p>R&D “Track”   Program</p>'
    );
  });

  it('decodes numeric entities in fetched html', () => {
    expect(decodeFetchedHtml('<p>&#39;hello&#39; &#8212; test</p>')).toBe("<p>'hello' — test</p>");
  });

  it('returns empty string for nullish values', () => {
    expect(decodeFetchedHtml(undefined)).toBe('');
    expect(decodeFetchedHtml(null)).toBe('');
  });
});
