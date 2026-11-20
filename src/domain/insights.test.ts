import { describe, expect, it } from 'vitest';
import type { Entry } from './types';
import { buildCycleContext, cycleByKey } from './cycles';
import {
  balanceSeries,
  cumulativeSpend,
  cyclePoints,
  dailySpend,
  dailyStats,
  descriptionTrend,
  fixedShareOf,
  niceScale,
  rangeCycles,
  rateOf,
  records,
  runs,
  spendingPace,
  topDescriptions,
  weekdayOf,
} from './insights';

let seq = 0;
const e = (date: string, amountFils: number, description: string, type: Entry['type'] = 'spend'): Entry => ({
  id: `e${++seq}`,
  date,
  amountFils,
  description,
  type,
  createdAt: seq,
  ...(type === 'income' ? { salary: true } : {}),
});

// Payday 26. Cycles: Sep (26 Aug – 25 Sep), Oct (26 Sep – 25 Oct), Nov (26 Oct – 25 Nov).
const entries = [
  e('2026-08-26', 800_000, 'Salary', 'income'),
  e('2026-08-26', 100_000, 'Savings', 'savings'),
  e('2026-08-27', 10_000, 'Coffee'),
  e('2026-09-01', 20_000, 'Groceries'),
  e('2026-09-26', 800_000, 'Salary', 'income'),
  e('2026-09-26', 100_000, 'Savings', 'savings'),
  e('2026-09-26', 400_000, 'Rent', 'fixed'),
  e('2026-09-28', 5_000, 'Coffee'),
  e('2026-10-10', 300_000, 'Car', 'withdrawal'),
  e('2026-10-11', 450_000, 'Car repair'),
  e('2026-10-26', 800_000, 'Salary', 'income'),
  e('2026-10-26', 100_000, 'Savings', 'savings'),
  e('2026-10-26', 400_000, 'Rent', 'fixed'),
  e('2026-10-27', 3_000, 'coffee'),
  e('2026-10-29', 9_000, 'Groceries'),
];
const ctx = buildCycleContext(entries, 26);
const TODAY = '2026-10-31';

describe('ranges and points', () => {
  it('picks cycles for each range', () => {
    expect(rangeCycles(entries, ctx, TODAY, 'all').map((c) => c.key)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(rangeCycles(entries, ctx, TODAY, 'last6')).toHaveLength(3);
    expect(rangeCycles(entries, ctx, TODAY, 'year')).toHaveLength(3);
    // A new year starts with its (still empty) January cycle.
    expect(rangeCycles(entries, ctx, '2027-01-02', 'year').map((c) => c.key)).toEqual(['2027-01']);
  });

  it('computes rates and fixed shares, null without income', () => {
    const [sep, oct] = cyclePoints(entries, rangeCycles(entries, ctx, TODAY, 'all'), TODAY);
    expect(rateOf(sep!.totals)).toBe(13); // 100 / 800
    expect(rateOf(oct!.totals)).toBe(-25); // (100 − 300) / 800
    expect(fixedShareOf(oct!.totals)).toBe(50);
    expect(rateOf({ ...sep!.totals, incomeFils: 0 })).toBeNull();
  });

  it('tracks the savings balance at each cycle end', () => {
    const cycles = rangeCycles(entries, ctx, TODAY, 'all');
    expect(balanceSeries(entries, cycles, 1_000_000, TODAY)).toEqual([1_100_000, 900_000, 1_000_000]);
    expect(balanceSeries(entries, cycles, undefined, TODAY)).toEqual([100_000, -100_000, 0]);
  });
});

describe('spending pace', () => {
  const nov = cycleByKey('2026-11', ctx);
  const earlier = [cycleByKey('2026-09', ctx), cycleByKey('2026-10', ctx)];

  it('accumulates spend by cycle day', () => {
    const curve = cumulativeSpend(entries, nov);
    expect(curve).toHaveLength(31);
    expect(curve.slice(0, 5)).toEqual([0, 3_000, 3_000, 12_000, 12_000]);
  });

  it('projects this cycle from the pace so far, against last and average cycles', () => {
    const pace = spendingPace(entries, nov, earlier, TODAY);
    expect(pace.current).toHaveLength(6); // 26 – 31 Oct
    expect(pace.projectedFils).toBe(Math.round((12_000 / 6) * 31));
    expect(pace.previous?.[pace.previous.length - 1]).toBe(455_000);
    expect(pace.average?.[1]).toBe(Math.round((10_000 + 0) / 2)); // day 2 of September's and October's cycles
  });
});

describe('daily stats', () => {
  it('knows weekdays (Monday = 0)', () => {
    expect(weekdayOf('2026-11-23')).toBe(0);
    expect(weekdayOf('2026-11-22')).toBe(6);
  });

  it('averages spend over elapsed days and by weekday', () => {
    const nov = [cycleByKey('2026-11', ctx)];
    const stats = dailyStats(entries, nov, TODAY);
    expect(stats.days).toBe(6);
    expect(stats.averageFils).toBe(2_000);
    expect(stats.byWeekday[1]).toBe(3_000); // Tue 27 Oct
    expect(stats.byWeekday[3]).toBe(9_000); // Thu 29 Oct
  });

  it('gives a cell per day for the heatmap', () => {
    const days = dailySpend(entries, cycleByKey('2026-11', ctx));
    expect(days).toHaveLength(31);
    expect(days[1]).toEqual({ date: '2026-10-27', fils: 3_000 });
  });
});

describe('description trend', () => {
  const cycles = rangeCycles(entries, ctx, TODAY, 'all');
  it('totals one description per cycle, case-insensitively', () => {
    expect(descriptionTrend(entries, cycles, 'coffee')).toEqual([10_000, 5_000, 3_000]);
  });
  it('offers the most-spent descriptions to pick from', () => {
    expect(topDescriptions(entries, cycles).map((d) => d.key)).toEqual(['car repair', 'groceries', 'coffee']);
  });
});

describe('streaks and records', () => {
  it('finds the longest and current run', () => {
    expect(runs([true, true, false, true])).toEqual({ current: 1, best: 2 });
    expect(runs([])).toEqual({ current: 0, best: 0 });
  });

  it('works on completed cycles and all days', () => {
    const r = records(entries, ctx, TODAY);
    // Sep: net saved +100, no withdrawal, under income. Oct: net saved −200, withdrew, over income (855 > 800).
    expect(r.positiveNetSaved).toEqual({ current: 0, best: 1 });
    expect(r.noWithdrawals).toEqual({ current: 0, best: 1 });
    expect(r.underIncome).toEqual({ current: 0, best: 1 });
    expect(r.biggestExpense?.description).toBe('Car repair');
    expect(r.bestCycle?.cycle.key).toBe('2026-09');
    expect(r.lowestSpendingCycle?.cycle.key).toBe('2026-09');
    // Last spend was 29 Oct; 30 and 31 Oct had none.
    expect(r.noSpendDays.current).toBe(2);
  });

  it('copes with no data', () => {
    const r = records([], ctx, TODAY);
    expect(r.biggestExpense).toBeNull();
    expect(r.noSpendDays).toEqual({ current: 0, best: 0 });
  });
});

describe('niceScale', () => {
  it('rounds the top up to a friendly step', () => {
    expect(niceScale(855_000)).toEqual({ max: 1_000_000, ticks: [0, 250_000, 500_000, 750_000, 1_000_000] });
    expect(niceScale(12_300).max).toBe(15_000);
    expect(niceScale(0)).toEqual({ max: 1000, ticks: [0, 1000] });
  });
});
