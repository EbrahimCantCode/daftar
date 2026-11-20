import { describe, expect, it } from 'vitest';
import type { Entry, RecurringItem } from './types';
import { buildCycleContext } from './cycles';
import { planRecurring, postingDate, resumeItem, type RecurringPlan } from './recurring';
import { cycleByKey } from './cycles';

const item = (overrides: Partial<RecurringItem> = {}): RecurringItem => ({
  id: 'gym',
  name: 'Gym',
  amountFils: 25_000,
  timing: 'day',
  dayOfMonth: 5,
  type: 'fixed',
  active: true,
  nextCycle: '2026-11',
  createdAt: 0,
  ...overrides,
});
const savings = (overrides: Partial<RecurringItem> = {}) =>
  item({ id: 'sav', name: 'Savings', amountFils: 200_000, timing: 'payday', type: 'savings', ...overrides });

let seq = 0;
const salary = (date: string): Entry => ({ id: `sal${++seq}`, date, amountFils: 850_000, description: 'Salary', type: 'income', salary: true, createdAt: seq });

/** Applies a plan the way the database layer does. */
function apply(items: RecurringItem[], generated: Set<string>, entries: Map<string, Entry>, plan: RecurringPlan) {
  for (const e of plan.entries) entries.set(e.id, e);
  for (const k of plan.generatedKeys) generated.add(k);
  for (const m of plan.moves) entries.set(m.id, { ...entries.get(m.id)!, date: m.date });
  return items.map((i) => ({ ...i, nextCycle: plan.cursors.get(i.id) ?? i.nextCycle }));
}

const run = (items: RecurringItem[], generated: Set<string>, entries: Map<string, Entry>, today: string) => {
  const all = [...entries.values()];
  return apply(items, generated, entries, planRecurring(items, generated, all, buildCycleContext(all, 26), today, 42));
};

describe('planRecurring per pay cycle', () => {
  it('posts a day-of-month item on that day inside the current cycle', () => {
    const plan = planRecurring([item()], new Set(), [], buildCycleContext([], 26), '2026-11-21', 42);
    expect(plan.entries).toEqual([
      {
        id: 'rec:gym:2026-11',
        date: '2026-11-05',
        amountFils: 25_000,
        description: 'Gym',
        type: 'fixed',
        recurringId: 'gym',
        recurringCycle: '2026-11',
        createdAt: 42,
      },
    ]);
    expect(plan.generatedKeys).toEqual(['gym:2026-11']);
    expect(plan.cursors.get('gym')).toBe('2026-12');
  });

  it('posts payday items on the first day of the cycle', () => {
    const plan = planRecurring([savings()], new Set(), [], buildCycleContext([], 26), '2026-11-21');
    expect(plan.entries[0]?.date).toBe('2026-10-26');
  });

  it('places days on or after payday in the payday month, earlier days in the next', () => {
    const ctx = buildCycleContext([], 26);
    const nov = cycleByKey('2026-11', ctx);
    expect(postingDate(item({ dayOfMonth: 28 }), nov, 26)).toBe('2026-10-28');
    expect(postingDate(item({ dayOfMonth: 26 }), nov, 26)).toBe('2026-10-26');
    expect(postingDate(item({ dayOfMonth: 25 }), nov, 26)).toBe('2026-11-25');
    expect(postingDate(item({ dayOfMonth: 31 }), cycleByKey('2026-12', ctx), 26)).toBe('2026-11-30');
  });

  it('is idempotent across repeated runs', () => {
    let items = [item(), savings()];
    const generated = new Set<string>();
    const entries = new Map<string, Entry>();
    items = run(items, generated, entries, '2026-11-21');
    expect(entries.size).toBe(2);
    items = run(items, generated, entries, '2026-11-21');
    expect(entries.size).toBe(2);
    // A stale cursor (two tabs racing) is still stopped by the log.
    run(items.map((i) => ({ ...i, nextCycle: '2026-11' })), generated, entries, '2026-11-21');
    expect(entries.size).toBe(2);
  });

  it('backfills every cycle missed since the app was last opened', () => {
    const plan = planRecurring([item({ nextCycle: '2026-09' })], new Set(), [], buildCycleContext([], 26), '2026-12-03');
    expect(plan.entries.map((e) => e.id)).toEqual(['rec:gym:2026-09', 'rec:gym:2026-10', 'rec:gym:2026-11', 'rec:gym:2026-12']);
    expect(plan.cursors.get('gym')).toBe('2027-01');
  });

  it('starts the new cycle as soon as an early salary is logged', () => {
    let items = [item(), savings()];
    const generated = new Set<string>();
    const entries = new Map<string, Entry>();
    items = run(items, generated, entries, '2026-11-21');
    // Salary arrives early on the 22nd: December's cycle starts today.
    const s = salary('2026-11-22');
    entries.set(s.id, s);
    items = run(items, generated, entries, '2026-11-22');
    const dec = [...entries.values()].filter((e) => e.recurringCycle === '2026-12');
    expect(dec.map((e) => [e.description, e.date])).toEqual([
      ['Gym', '2026-12-05'],
      ['Savings', '2026-11-22'],
    ]);
    // Running again on the same day posts nothing new.
    run(items, generated, entries, '2026-11-22');
    expect(entries.size).toBe(5);
  });

  it('moves posted entries back inside their cycle when its start moves', () => {
    let items = [savings(), item({ id: 'late', name: 'Late item', dayOfMonth: 24 })];
    const generated = new Set<string>();
    const entries = new Map<string, Entry>();
    // Both December items posted while the 26th was still the expected payday.
    items = run(items, generated, entries, '2026-11-27');
    expect(entries.get('rec:sav:2026-12')?.date).toBe('2026-11-26');
    expect(entries.get('rec:late:2026-12')?.date).toBe('2026-12-24');
    // Then the salary is logged as having arrived on the 28th: December starts later.
    const s = salary('2026-11-28');
    entries.set(s.id, s);
    run(items, generated, entries, '2026-11-28');
    expect(entries.get('rec:sav:2026-12')?.date).toBe('2026-11-28');
    // November's late item (24 Nov) is still inside November, so it stays.
    expect(entries.get('rec:late:2026-11')?.date).toBe('2026-11-24');
  });

  it('crosses the year boundary', () => {
    const plan = planRecurring([item({ nextCycle: '2026-12' })], new Set(), [], buildCycleContext([], 26), '2027-01-10');
    expect(plan.entries.map((e) => [e.id, e.date])).toEqual([
      ['rec:gym:2026-12', '2026-12-05'],
      ['rec:gym:2027-01', '2027-01-05'],
    ]);
  });

  it('skips paused items and items already up to date', () => {
    const plan = planRecurring(
      [item({ active: false, nextCycle: '2026-01' }), item({ id: 'later', nextCycle: '2026-12' })],
      new Set(),
      [],
      buildCycleContext([], 26),
      '2026-11-21',
    );
    expect(plan.entries).toEqual([]);
    expect(plan.cursors.size).toBe(0);
  });

  it('ignores a corrupt cursor instead of looping', () => {
    expect(planRecurring([item({ nextCycle: 'garbage' })], new Set(), [], buildCycleContext([], 26), '2026-11-21').entries).toEqual([]);
  });
});

describe('resumeItem', () => {
  it('does not backfill cycles spent paused', () => {
    const resumed = resumeItem(item({ active: false, nextCycle: '2026-06' }), '2026-11');
    expect(resumed).toMatchObject({ active: true, nextCycle: '2026-11' });
  });

  it('keeps a cursor that is already ahead', () => {
    expect(resumeItem(item({ active: false, nextCycle: '2026-12' }), '2026-11').nextCycle).toBe('2026-12');
  });
});
