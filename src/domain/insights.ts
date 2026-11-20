import type { Entry } from './types';
import { addDays } from './dates';
import { cyclesWithData, cycleLength, dayIndex, daysElapsed, entriesInCycle, type Cycle, type CycleContext } from './cycles';
import { descriptionKey } from './text';
import { breakdown, savingsBalance, totalsOf, type Totals } from './totals';

// Pure series for the Insights tab. Amounts stay in integer fils; percentages and
// averages are display values only.

export type InsightRange = 'last6' | 'last12' | 'year' | 'all';

export interface CyclePoint {
  cycle: Cycle;
  totals: Totals;
  /** True once the cycle has ended. */
  complete: boolean;
}

/** Cycles with data in the chosen range, oldest first. */
export function rangeCycles(entries: readonly Entry[], ctx: CycleContext, today: string, range: InsightRange): Cycle[] {
  const all = cyclesWithData(entries, ctx, today);
  if (range === 'last6') return all.slice(-6);
  if (range === 'last12') return all.slice(-12);
  if (range === 'year') return all.filter((c) => c.key.startsWith(today.slice(0, 4)));
  return all;
}

export function cyclePoints(entries: readonly Entry[], cycles: readonly Cycle[], today: string): CyclePoint[] {
  return cycles.map((cycle) => ({ cycle, totals: totalsOf(entriesInCycle(entries, cycle)), complete: cycle.end < today }));
}

/** Net saved ÷ income as a whole percentage, or null without income. */
export function rateOf(t: Totals): number | null {
  return t.incomeFils > 0 ? Math.round((t.netSavedFils * 100) / t.incomeFils) : null;
}

/** Fixed ÷ income as a whole percentage, or null without income. */
export function fixedShareOf(t: Totals): number | null {
  return t.incomeFils > 0 ? Math.round((t.fixedFils * 100) / t.incomeFils) : null;
}

/**
 * Savings balance at the end of each cycle (or today, for the open one). Without a
 * starting balance the line starts at 0, so it shows the change since the first entry.
 */
export function balanceSeries(entries: readonly Entry[], cycles: readonly Cycle[], startingFils: number | undefined, today: string): number[] {
  return cycles.map((c) => savingsBalance(entries, startingFils ?? 0, c.end < today ? c.end : today));
}

// ---- Spending pace -------------------------------------------------------------

/** Cumulative spend (type "spend") by day of the cycle: index 0 is the first day. */
export function cumulativeSpend(entries: readonly Entry[], cycle: Cycle, days = cycleLength(cycle)): number[] {
  const daily = new Array<number>(days).fill(0);
  for (const e of entries) {
    if (e.type !== 'spend' || e.date < cycle.start || e.date > cycle.end) continue;
    const i = dayIndex(cycle, e.date);
    if (i < days) daily[i]! += e.amountFils;
  }
  let run = 0;
  return daily.map((v) => (run += v));
}

export interface Pace {
  /** Cumulative spend so far this cycle, one value per elapsed day. */
  current: number[];
  /** The previous cycle's cumulative spend, full length. */
  previous: number[] | null;
  /** Average cumulative spend by day over the earlier cycles in range. */
  average: number[] | null;
  /** Spend so far ÷ days so far × cycle length. */
  projectedFils: number;
  cycleDays: number;
}

export function spendingPace(entries: readonly Entry[], current: Cycle, earlier: readonly Cycle[], today: string): Pace {
  const days = cycleLength(current);
  const elapsed = Math.max(1, daysElapsed(current, today));
  const sofar = cumulativeSpend(entries, current).slice(0, elapsed);
  const prevCycle = earlier[earlier.length - 1];
  const previous = prevCycle ? cumulativeSpend(entries, prevCycle) : null;
  let average: number[] | null = null;
  if (earlier.length) {
    const curves = earlier.map((c) => cumulativeSpend(entries, c));
    const longest = Math.max(...curves.map((c) => c.length));
    average = Array.from({ length: longest }, (_, i) => {
      // A shorter cycle holds its final total for the days it doesn't have.
      const values = curves.map((c) => c[Math.min(i, c.length - 1)]!);
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    });
  }
  const spent = sofar[sofar.length - 1] ?? 0;
  return { current: sofar, previous, average, projectedFils: Math.round((spent / elapsed) * days), cycleDays: days };
}

// ---- Daily spending ---------------------------------------------------------------

export interface DailyStats {
  averageFils: number;
  /** Mean spend per weekday, Monday first. */
  byWeekday: number[];
  days: number;
}

/** Weekday of a date, 0 = Monday. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Average daily spend over the cycles' elapsed days, and the mean for each weekday. */
export function dailyStats(entries: readonly Entry[], cycles: readonly Cycle[], today: string): DailyStats {
  const totals = new Array<number>(7).fill(0);
  const counts = new Array<number>(7).fill(0);
  let spent = 0;
  let days = 0;
  const spendByDay = new Map<string, number>();
  for (const e of entries) if (e.type === 'spend') spendByDay.set(e.date, (spendByDay.get(e.date) ?? 0) + e.amountFils);
  for (const c of cycles) {
    const n = daysElapsed(c, today);
    for (let i = 0; i < n; i++) {
      const date = addDays(c.start, i);
      const w = weekdayOf(date);
      const v = spendByDay.get(date) ?? 0;
      totals[w]! += v;
      counts[w]!++;
      spent += v;
      days++;
    }
  }
  return {
    averageFils: days ? Math.round(spent / days) : 0,
    byWeekday: totals.map((t, i) => (counts[i] ? Math.round(t / counts[i]!) : 0)),
    days,
  };
}

/** Spend per day of one cycle, for the heatmap. */
export function dailySpend(entries: readonly Entry[], cycle: Cycle): { date: string; fils: number }[] {
  const days = cycleLength(cycle);
  const out = Array.from({ length: days }, (_, i) => ({ date: addDays(cycle.start, i), fils: 0 }));
  for (const e of entries) {
    if (e.type !== 'spend' || e.date < cycle.start || e.date > cycle.end) continue;
    out[dayIndex(cycle, e.date)]!.fils += e.amountFils;
  }
  return out;
}

// ---- Description trend --------------------------------------------------------------

/** The most-spent descriptions in the range, for picking a trend. */
export function topDescriptions(entries: readonly Entry[], cycles: readonly Cycle[], n = 8): { key: string; label: string }[] {
  const inRange = cycles.flatMap((c) => entriesInCycle(entries, c)).filter((e) => e.type === 'spend');
  return breakdown(inRange, Number.POSITIVE_INFINITY)
    .slice(0, n)
    .map((r) => ({ key: r.key, label: r.label }));
}

/** Total spent on one description (trimmed, case-insensitive) in each cycle. */
export function descriptionTrend(entries: readonly Entry[], cycles: readonly Cycle[], key: string): number[] {
  return cycles.map((c) =>
    entriesInCycle(entries, c)
      .filter((e) => e.type === 'spend' && descriptionKey(e.description) === key)
      .reduce((s, e) => s + e.amountFils, 0),
  );
}

// ---- Streaks & records ----------------------------------------------------------------

export interface Streak {
  current: number;
  best: number;
}

/** Longest run of `true`, and the run that ends with the last value. */
export function runs(flags: readonly boolean[]): Streak {
  let run = 0;
  let best = 0;
  for (const f of flags) {
    run = f ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

export interface Records {
  /** Completed cycles in a row with positive net saved. */
  positiveNetSaved: Streak;
  /** Completed cycles in a row with nothing taken out of savings. */
  noWithdrawals: Streak;
  /** Completed cycles in a row where total out stayed within income (withdrawals not counted). */
  underIncome: Streak;
  /** Days in a row without spending, up to today. */
  noSpendDays: Streak;
  biggestExpense: Entry | null;
  bestCycle: CyclePoint | null;
  lowestSpendingCycle: CyclePoint | null;
}

export function records(entries: readonly Entry[], ctx: CycleContext, today: string): Records {
  const points = cyclePoints(entries, cyclesWithData(entries, ctx, today), today);
  const done = points.filter((p) => p.complete);

  const spendDays = new Set(entries.filter((e) => e.type === 'spend').map((e) => e.date));
  const flags: boolean[] = [];
  if (points.length) {
    let first = entries.reduce((m, e) => (e.date < m ? e.date : m), today);
    if (first > today) first = today;
    for (let d = first; d <= today; d = addDays(d, 1)) flags.push(!spendDays.has(d));
  }

  const spends = entries.filter((e) => e.type === 'spend');
  const pick = (list: CyclePoint[], f: (p: CyclePoint) => number, dir: 1 | -1) =>
    list.length ? list.reduce((a, b) => (dir * (f(b) - f(a)) > 0 ? b : a)) : null;

  return {
    positiveNetSaved: runs(done.map((p) => p.totals.netSavedFils > 0)),
    noWithdrawals: runs(done.map((p) => p.totals.withdrawnFils === 0)),
    underIncome: runs(done.map((p) => p.totals.incomeFils > 0 && p.totals.totalOutFils <= p.totals.incomeFils)),
    noSpendDays: runs(flags),
    biggestExpense: spends.length ? spends.reduce((a, b) => (b.amountFils > a.amountFils ? b : a)) : null,
    bestCycle: pick(done, (p) => p.totals.netSavedFils, 1),
    lowestSpendingCycle: pick(done, (p) => p.totals.spentFils, -1),
  };
}

// ---- Axes -------------------------------------------------------------------------------

/** A round top for a chart axis (in fils) and evenly spaced gridline values. */
export function niceScale(maxFils: number, steps = 4): { max: number; ticks: number[] } {
  if (maxFils <= 0) return { max: 1000, ticks: [0, 1000] };
  const raw = maxFils / steps;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const max = Math.ceil(maxFils / step) * step;
  const ticks = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v));
  return { max, ticks };
}
