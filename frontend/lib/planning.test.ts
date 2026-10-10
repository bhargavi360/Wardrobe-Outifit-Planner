import { describe, expect, it } from 'vitest';
import { monday, shiftDay } from './planning';

describe('local calendar dates', () => {
  it('finds the same week for all seven days without shifting time zones', () => {
    for (let i = 0; i < 7; i++) expect(monday(shiftDay('2026-10-05', i))).toBe('2026-10-05');
  });
  it('moves correctly across month, year, and leap-year boundaries', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftDay('2026-01-01', -7)).toBe('2025-12-25');
  });
});
