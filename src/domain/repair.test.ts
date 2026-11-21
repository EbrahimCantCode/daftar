import { describe, expect, it } from 'vitest';
import { buildCycleContext, cycleFor, entriesInCycle } from './cycles';
import { migrateToV2, type LegacySnapshot } from './migrate';
import { planRecurring } from './recurring';
import { realignPostings, repairPostings } from './repair';
import type { Entry, LegacyRecurringItem, RecurringItem } from './types';

// Reproduces the reported data: items made mid-November under the calendar-month
// version, then migrated to pay cycles (payday 26).
const T = Date.UTC(2026, 10, 12, 9);
const item = (o: Partial<LegacyRecurringItem>): LegacyRecurringItem => ({
  id: 'x',
  name: 'x',
  amountFils: 1,
  dayOfMonth: 1,
  type: 'fixed',
  active: true,
  nextMonth: '2026-12',
  createdAt: T,
  ...o,
});
const posted = (id: string, name: string, date: string, amountFils: number): Entry => ({
  id: `rec:${id}:${date.slice(0, 7)}`,
  date,
  amountFils,
  description: name,
  type: 'fixed',
  recurringId: id,
  createdAt: T,
});

const reported: LegacySnapshot = {
  settings: { theme: 'system', monthlyIncomeFils: 150_000 },
  recurring: [
    item({ id: 'claude', name: 'Claude', dayOfMonth: 5, amountFils: 7_550 }),
    item({ id: 'gym', name: 'Gym', dayOfMonth: 27, amountFils: 20_000 }),
    // Posted on the 1st, then changed to the 29th.
    item({ id: 'yt', name: 'Youtube music', dayOfMonth: 29, amountFils: 3_390 }),
  ],
  entries: [
    posted('claude', 'Claude', '2026-11-05', 7_550),
    posted('gym', 'Gym', '2026-11-27', 20_000),
    posted('yt', 'Youtube music', '2026-11-01', 3_390),
  ],
};
const reportedLog = ['claude:2026-11', 'gym:2026-11', 'yt:2026-11'];

describe('the reported bug, before the fix', () => {
  it('leaves Gym out of the November cycle and YouTube on the 1st', () => {
    const { data, generatedKeys } = migrateToV2(reported, reportedLog);
    const ctx = buildCycleContext(data.entries, 26);
    const plan = planRecurring(data.recurring, new Set(generatedKeys), data.entries, ctx, '2026-11-21');
    const nov = entriesInCycle([...data.entries, ...plan.entries], cycleFor('2026-11-21', ctx));
    expect(nov.map((e) => `${e.description} ${e.date}`).sort()).toEqual(['Claude 2026-11-05', 'Youtube music 2026-11-01']);
  });
});

describe('repairPostings', () => {
  const { data, generatedKeys } = migrateToV2(reported, reportedLog);
  const fixed = repairPostings(data, generatedKeys, '2026-11-21');
  const byId = new Map(data.entries.map((e) => [e.id, e]));
  for (const id of fixed.removedIds) byId.delete(id);
  for (const e of fixed.changed) byId.set(e.id, e);
  const entries = [...byId.values()];
  const ctx = buildCycleContext(entries, 26);
  const plan = planRecurring(fixed.recurring, new Set(fixed.generatedKeys), entries, ctx, '2026-11-21');
  const after = [...entries, ...plan.entries];
  const nov = entriesInCycle(after, cycleFor('2026-11-21', ctx));

  it('puts Gym in the November cycle and YouTube on the 29th', () => {
    expect(nov.map((e) => `${e.description} ${e.date}`).sort()).toEqual(['Claude 2026-11-05', 'Gym 2026-10-27', 'Youtube music 2026-10-29']);
  });

  it('gives every posted entry a unique id for its cycle', () => {
    const ids = after.filter((e) => e.recurringId).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('rec:gym:2026-11');
    expect(ids).toContain('rec:gym:2026-12');
  });

  it('leaves December with exactly one Gym, the one already written on 27 Nov', () => {
    const dec = entriesInCycle(after, cycleFor('2026-11-30', ctx)).filter((e) => e.recurringId === 'gym');
    expect(dec.map((e) => e.date)).toEqual(['2026-11-27']);
    const decPlan = planRecurring(
      fixed.recurring.map((r) => ({ ...r, nextCycle: plan.cursors.get(r.id) ?? r.nextCycle })),
      new Set([...fixed.generatedKeys, ...plan.generatedKeys]),
      after,
      ctx,
      '2026-11-27',
    );
    expect(decPlan.entries.map((e) => e.id)).toEqual(['rec:claude:2026-12', 'rec:yt:2026-12']);
  });

  it('does nothing more when run again', () => {
    const again = repairPostings({ ...data, entries: after, recurring: fixed.recurring }, [...fixed.generatedKeys, ...plan.generatedKeys], '2026-11-21');
    expect(again.changed.filter((e) => !after.some((a) => a.id === e.id && a.date === e.date))).toEqual([]);
    const plan2 = planRecurring(again.recurring, new Set(again.generatedKeys), after, ctx, '2026-11-21');
    expect(plan2.entries).toEqual([]);
  });

  it('leaves past cycles alone', () => {
    const old: Entry = { ...posted('gym', 'Gym', '2026-08-03', 20_000), id: 'rec:gym:2026-08' };
    const r = repairPostings({ ...data, entries: [...data.entries, old] }, generatedKeys, '2026-11-21');
    expect(r.changed.find((e) => e.id === old.id)).toBeUndefined();
  });
});

describe('realignPostings', () => {
  const gym: RecurringItem = { id: 'gym', name: 'Gym', amountFils: 20_000, timing: 'day', dayOfMonth: 27, type: 'fixed', active: true, nextCycle: '2026-12', createdAt: 0 };
  const ctx = buildCycleContext([], 26);
  const entry: Entry = { ...posted('gym', 'Gym', '2026-10-27', 20_000), id: 'rec:gym:2026-11', recurringCycle: '2026-11' };

  it('moves this cycle’s untouched entry with the item', () => {
    const out = realignPostings(gym, { ...gym, dayOfMonth: 2, amountFils: 25_000 }, [entry], ctx, '2026-11-21');
    expect(out).toEqual([{ ...entry, date: '2026-11-02', amountFils: 25_000 }]);
  });

  it('keeps an entry edited by hand, and past cycles', () => {
    expect(realignPostings(gym, { ...gym, dayOfMonth: 2 }, [{ ...entry, amountFils: 18_000 }], ctx, '2026-11-21')).toEqual([]);
    expect(realignPostings(gym, { ...gym, dayOfMonth: 2 }, [entry], ctx, '2026-12-01')).toEqual([]);
  });
});
