import { describe, expect, it } from 'vitest';

import { buildPaginationTokens } from '@/lib/utils/pagination';

describe('buildPaginationTokens', () => {
  it('returns all page numbers for short ranges', () => {
    expect(buildPaginationTokens(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('collapses long ranges around the current page', () => {
    expect(buildPaginationTokens(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  });

  it('shows the trailing page window near the end', () => {
    expect(buildPaginationTokens(9, 10)).toEqual([1, 'ellipsis', 6, 7, 8, 9, 10]);
  });
});
