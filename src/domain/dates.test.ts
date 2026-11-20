import { describe, expect, it } from 'vitest';
import { addMonths, clampedDate, daysInMonth, isValidDate, monthsBetween, ordinal, todayISO } from './dates';

describe('dates', () => {
  it('uses the local calendar day', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('adds months across year boundaries', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-03', -14)).toBe('2025-01');
  });

  it('lists months inclusively', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthsBetween('2026-05', '2026-05')).toEqual(['2026-05']);
    expect(monthsBetween('2026-06', '2026-05')).toEqual([]);
  });

  it('knows month lengths, including leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('clamps days to the end of short months', () => {
    expect(clampedDate('2026-02', 31)).toBe('2026-02-28');
    expect(clampedDate('2028-02', 31)).toBe('2028-02-29');
    expect(clampedDate('2026-04', 31)).toBe('2026-04-30');
    expect(clampedDate('2026-01', 31)).toBe('2026-01-31');
    expect(clampedDate('2026-01', 1)).toBe('2026-01-01');
  });

  it('validates real calendar dates', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('26-1-1')).toBe(false);
  });

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 31].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '31st',
    ]);
  });
});
