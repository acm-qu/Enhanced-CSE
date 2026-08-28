import { describe, expect, it } from 'vitest';

import { fixSeniorProjectYear } from '@/lib/utils/senior-projects';

describe('fixSeniorProjectYear', () => {
  it('advances the year on senior project titles', () => {
    expect(fixSeniorProjectYear('7. Senior Projects 2019')).toBe('7. Senior Projects 2020');
    expect(fixSeniorProjectYear('Senior Project 2023')).toBe('Senior Project 2024');
  });

  it('leaves titles marked (Fall) untouched', () => {
    expect(fixSeniorProjectYear('12. Senior Projects 2024 (Fall)')).toBe('12. Senior Projects 2024 (Fall)');
    expect(fixSeniorProjectYear('Senior Projects 2024 ( fall )')).toBe('Senior Projects 2024 ( fall )');
  });

  it('advances both ends of a year range', () => {
    expect(fixSeniorProjectYear('Senior Projects 2019-2020')).toBe('Senior Projects 2020-2021');
  });

  it('ignores titles that are not senior projects', () => {
    expect(fixSeniorProjectYear('CSE Electives 2019')).toBe('CSE Electives 2019');
    expect(fixSeniorProjectYear('Senior Projects')).toBe('Senior Projects');
  });
});
