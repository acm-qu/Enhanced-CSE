import { describe, expect, it } from 'vitest';

import { formatContentLabel } from '@/lib/utils/content';

describe('formatContentLabel', () => {
  it('decodes frontend labels from synced content', () => {
    expect(formatContentLabel('Offerings &amp; Services')).toBe('Offerings & Services');
  });
});
