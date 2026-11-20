import { describe, expect, it } from 'vitest';
import { buildCycleContext } from './cycles';
import { migrateToV2, type LegacySnapshot } from './migrate';
import { planRecurring } from './recurring';
import type { Entry, LegacyRecurringItem } from './types';

const T = Date.UTC(2026, 10, 1);
const legacyItem = (o: Partial<LegacyRecurringItem>): LegacyRecurringItem => ({
  id: 'gym',
  name: 'Gym',
  amountFils: 25_000,
  dayOfMonth: 5,
  type: 'fixed',
  active: true,
  nextMonth: '2026-12',
  createdAt: T,
  ...o,
});
const entry = (o: Partial<Entry>): Entry => ({ id: 'e', date: '2026-11-03', amountFils: 1_200, description: 'Karak', type: 'spend', createdAt: T, ...o });

const v1: LegacySnapshot = {
  settings: { theme: 'dark', monthlyIncomeFils: 850_000, dailyGoalFils: 5_000, dailyGoalSince: '2026-11-15' },
  recurring: [
    legacyItem({}),
    legacyItem({ id: 'rent', name: 'Rent', dayOfMonth: 28, amountFils: 300_000 }),
    legacyItem({ id: 'cl', name: 'Claude', dayOfMonth: 20, active: false }),
  ],
  entries: [
    entry({}),
    entry({ id: 'rec:gym:2026-11', date: '2026-11-05', amountFils: 25_000, description: 'Gym', type: 'fixed', recurringId: 'gym' }),
    entry({ id: 'rec:rent:2026-10', date: '2026-10-28', amountFils: 300_000, description: 'Rent', type: 'fixed', recurringId: 'rent' }),
    entry({ id: 'rec:rent:2026-11', date: '2026-11-28', amountFils: 300_000, description: 'Rent', type: 'fixed', recurringId: 'rent' }),
  ],
};
const v1Log = ['gym:2026-11', 'rent:2026-10', 'rent:2026-11', 'cl:2026-11'];

describe('migrateToV2', () => {
  const { data, generatedKeys } = migrateToV2(v1, v1Log);

  it('turns the monthly income into the usual salary and sets payday to the 26th', () => {
    expect(data.settings).toEqual({
      theme: 'dark',
      paydayDay: 26,
      schemaVersion: 2,
      usualSalaryFils: 850_000,
      dailyGoalFils: 5_000,
      dailyGoalSince: '2026-11-15',
      salaryOfferPending: true,
    });
  });

  it('gives recurring items day timing and a cycle cursor', () => {
    expect(data.recurring.map((r) => [r.id, r.timing, r.nextCycle])).toEqual([
      ['gym', 'day', '2026-12'], // 5 Dec is in the December cycle
      ['rent', 'day', '2027-01'], // 28 Dec falls in the January cycle (26 Dec – 25 Jan)
      ['cl', 'day', '2026-12'],
    ]);
    expect(data.recurring.every((r) => !('nextMonth' in r))).toBe(true);
  });

  it('logs every posted entry under its cycle', () => {
    expect(generatedKeys).toEqual(expect.arrayContaining(['gym:2026-11', 'rent:2026-11', 'rent:2026-12']));
  });

  it('leaves entries untouched', () => {
    expect(data.entries).toBe(v1.entries);
  });

  it('posts nothing twice afterwards', () => {
    const ctx = buildCycleContext(data.entries, 26);
    const generated = new Set(generatedKeys);
    // Still in November: everything for November and December rent is already there.
    expect(planRecurring(data.recurring, generated, data.entries, ctx, '2026-11-21').entries).toEqual([]);
    // December's cycle starts on 26 Nov: only the gym is new (rent for December was posted on 28 Nov).
    const dec = planRecurring(data.recurring, generated, data.entries, ctx, '2026-11-26');
    expect(dec.entries.map((e) => e.id)).toEqual(['rec:gym:2026-12']);
  });

  it('is idempotent', () => {
    const again = migrateToV2(data, generatedKeys);
    expect(again.data).toEqual(data);
    expect(again.generatedKeys).toEqual(generatedKeys);
  });

  it('does not offer a salary when there is no data yet', () => {
    expect(migrateToV2({ entries: [], recurring: [], settings: { theme: 'system' } }, []).data.settings).toEqual({
      theme: 'system',
      paydayDay: 26,
      schemaVersion: 2,
    });
  });
});
