import type { Entry } from '../types';
import { addDays } from './dates';

// Only "spend" entries count toward the daily goal: fixed monthly items and
// savings are planned money, not day-to-day spending.

/** Total spend per day, in fils. */
export function spendByDay(entries: readonly Entry[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const e of entries) {
    if (e.type === 'spend') byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amountFils);
  }
  return byDay;
}

export function spendOnDay(entries: readonly Entry[], date: string): number {
  return spendByDay(entries).get(date) ?? 0;
}

/** How close today's spending is to the goal: 0 (nothing spent) to 1 (at or over). */
export function goalHeat(spentFils: number, goalFils: number): number {
  if (goalFils <= 0) return 0;
  return Math.min(1, Math.max(0, spentFils / goalFils));
}

export interface Streak {
  /** Days in a row, ending yesterday, spent at or under the goal. */
  current: number;
  /** Longest such run since the goal was set (including the current one). */
  best: number;
  /** Whether today is still at or under the goal so far. */
  todayUnder: boolean;
}

/**
 * A day keeps the streak when its spend is at or under the goal; a day with no
 * spending counts. Only days from `since` (when the goal was set) up to yesterday
 * are judged, since today is not over yet.
 */
export function goalStreak(entries: readonly Entry[], goalFils: number, since: string, today: string): Streak {
  const byDay = spendByDay(entries);
  const under = (date: string) => (byDay.get(date) ?? 0) <= goalFils;

  let run = 0;
  let best = 0;
  for (let day = since; day < today; day = addDays(day, 1)) {
    run = under(day) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best, todayUnder: under(today) };
}
