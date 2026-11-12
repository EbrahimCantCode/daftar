import { describe, expect, it } from 'vitest';
import type { Entry } from '../types';
import { addDays } from './dates';
import { goalHeat, goalStreak, spendOnDay } from './goal';

let seq = 0;
const e = (date: string, amountFils: number, type: Entry['type'] = 'spend'): Entry => ({
  id: `e${++seq}`,
  date,
  amountFils,
  description: 'x',
  type,
  createdAt: seq,
});

const GOAL = 5_000;

describe('spendOnDay', () => {
  it('counts only spend entries', () => {
    const entries = [e('2026-11-01', 2_000), e('2026-11-01', 25_000, 'fixed'), e('2026-11-01', 100_000, 'savings'), e('2026-11-02', 9_000)];
    expect(spendOnDay(entries, '2026-11-01')).toBe(2_000);
    expect(spendOnDay(entries, '2026-11-03')).toBe(0);
  });
});

describe('goalHeat', () => {
  it('goes from 0 to 1 and is capped', () => {
    expect(goalHeat(0, GOAL)).toBe(0);
    expect(goalHeat(2_500, GOAL)).toBe(0.5);
    expect(goalHeat(5_000, GOAL)).toBe(1);
    expect(goalHeat(9_000, GOAL)).toBe(1);
    expect(goalHeat(1_000, 0)).toBe(0);
  });
});

describe('goalStreak', () => {
  it('counts days at or under the goal, including no-spend days', () => {
    const entries = [e('2026-11-01', 4_000), e('2026-11-02', 5_000), e('2026-11-04', 1_000)];
    // Nov 1 under, Nov 2 exactly at the goal, Nov 3 nothing spent, Nov 4 under.
    expect(goalStreak(entries, GOAL, '2026-11-01', '2026-11-05')).toEqual({ current: 4, best: 4, todayUnder: true });
  });

  it('ignores fixed and savings entries', () => {
    const entries = [e('2026-11-01', 25_000, 'fixed'), e('2026-11-02', 250_000, 'savings')];
    expect(goalStreak(entries, GOAL, '2026-11-01', '2026-11-03').current).toBe(2);
  });

  it('breaks on a day over the goal and keeps the best run', () => {
    const entries = [e('2026-11-04', 5_001)];
    // Nov 1–3 under (3), Nov 4 over, Nov 5–6 under (2).
    expect(goalStreak(entries, GOAL, '2026-11-01', '2026-11-07')).toEqual({ current: 2, best: 3, todayUnder: true });
  });

  it('is zero right after an over-goal day', () => {
    expect(goalStreak([e('2026-11-06', 7_000)], GOAL, '2026-11-01', '2026-11-07')).toMatchObject({ current: 0, best: 5 });
  });

  it('does not count days before the goal was set', () => {
    expect(goalStreak([], GOAL, '2026-11-10', '2026-11-12').current).toBe(2);
    expect(goalStreak([], GOAL, '2026-11-12', '2026-11-12')).toEqual({ current: 0, best: 0, todayUnder: true });
  });

  it('does not judge today until it is over', () => {
    const entries = [e('2026-11-12', 8_000)];
    expect(goalStreak(entries, GOAL, '2026-11-10', '2026-11-12')).toEqual({ current: 2, best: 2, todayUnder: false });
  });

  it('runs across month and year boundaries', () => {
    expect(goalStreak([], GOAL, '2026-12-30', '2027-01-03').current).toBe(4);
    expect(goalStreak([], GOAL, '2028-02-27', '2028-03-01').current).toBe(3); // includes Feb 29
  });
});

describe('addDays', () => {
  it('crosses month ends and leap days', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
