import { describe, expect, it } from 'vitest';
import type { Entry, RecurringItem } from '../types';
import { generatedKeyFromEntryId, planRecurring, resumeItem, type RecurringPlan } from './recurring';

const item = (overrides: Partial<RecurringItem> = {}): RecurringItem => ({
  id: 'gym',
  name: 'Gym',
  amountFils: 25_000,
  dayOfMonth: 5,
  type: 'fixed',
  active: true,
  nextMonth: '2026-11',
  createdAt: 0,
  ...overrides,
});

/** Applies a plan the way the database layer does: add entries, log keys, move cursors. */
function apply(items: RecurringItem[], generated: Set<string>, entries: Map<string, Entry>, plan: RecurringPlan) {
  for (const e of plan.entries) entries.set(e.id, e);
  for (const k of plan.generatedKeys) generated.add(k);
  return items.map((i) => ({ ...i, nextMonth: plan.cursors.get(i.id) ?? i.nextMonth }));
}

describe('planRecurring', () => {
  it('creates the current month entry on its day', () => {
    const plan = planRecurring([item()], new Set(), '2026-11', 42);
    expect(plan.entries).toEqual([
      {
        id: 'rec:gym:2026-11',
        date: '2026-11-05',
        amountFils: 25_000,
        description: 'Gym',
        type: 'fixed',
        recurringId: 'gym',
        createdAt: 42,
      },
    ]);
    expect(plan.generatedKeys).toEqual(['gym:2026-11']);
    expect(plan.cursors.get('gym')).toBe('2026-12');
  });

  it('is idempotent across repeated runs', () => {
    let items = [item(), item({ id: 'claude', name: 'Claude subscription', dayOfMonth: 20 })];
    const generated = new Set<string>();
    const entries = new Map<string, Entry>();

    items = apply(items, generated, entries, planRecurring(items, generated, '2026-11'));
    expect(entries.size).toBe(2);

    const again = planRecurring(items, generated, '2026-11');
    expect(again.entries).toEqual([]);

    // Even with a stale cursor (e.g. two tabs racing), the log prevents duplicates.
    const stale = planRecurring(items.map((i) => ({ ...i, nextMonth: '2026-11' })), generated, '2026-11');
    expect(stale.entries).toEqual([]);
  });

  it('does not recreate an entry the user deleted or edited', () => {
    let items = [item()];
    const generated = new Set<string>();
    const entries = new Map<string, Entry>();
    items = apply(items, generated, entries, planRecurring(items, generated, '2026-11'));

    entries.delete('rec:gym:2026-11');
    const resetCursor = items.map((i) => ({ ...i, nextMonth: '2026-11' }));
    expect(planRecurring(resetCursor, generated, '2026-11').entries).toEqual([]);
  });

  it('backfills every month missed since the app was last opened', () => {
    const plan = planRecurring([item({ nextMonth: '2026-09' })], new Set(), '2026-12');
    expect(plan.entries.map((e) => e.date)).toEqual(['2026-09-05', '2026-10-05', '2026-11-05', '2026-12-05']);
    expect(plan.cursors.get('gym')).toBe('2027-01');
  });

  it('backfills across a year boundary', () => {
    const plan = planRecurring([item({ nextMonth: '2026-12' })], new Set(), '2027-02');
    expect(plan.entries.map((e) => e.id)).toEqual(['rec:gym:2026-12', 'rec:gym:2027-01', 'rec:gym:2027-02']);
  });

  it('only fills the gaps when some months were already generated', () => {
    const plan = planRecurring([item({ nextMonth: '2026-09' })], new Set(['gym:2026-10']), '2026-11');
    expect(plan.entries.map((e) => e.id)).toEqual(['rec:gym:2026-09', 'rec:gym:2026-11']);
  });

  it('clamps day 31 to the last day of short months', () => {
    const plan = planRecurring([item({ dayOfMonth: 31, nextMonth: '2026-01' })], new Set(), '2026-04');
    expect(plan.entries.map((e) => e.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('uses Feb 29 in leap years', () => {
    const plan = planRecurring([item({ dayOfMonth: 30, nextMonth: '2028-02' })], new Set(), '2028-02');
    expect(plan.entries[0]?.date).toBe('2028-02-29');
  });

  it('skips paused items and items already up to date', () => {
    const plan = planRecurring(
      [item({ active: false, nextMonth: '2026-01' }), item({ id: 'later', nextMonth: '2026-12' })],
      new Set(),
      '2026-11',
    );
    expect(plan.entries).toEqual([]);
    expect(plan.cursors.size).toBe(0);
  });

  it('keeps savings items typed as savings', () => {
    const plan = planRecurring([item({ id: 'save', name: 'Savings', type: 'savings' })], new Set(), '2026-11');
    expect(plan.entries[0]?.type).toBe('savings');
  });

  it('ignores a corrupt cursor instead of looping', () => {
    expect(planRecurring([item({ nextMonth: 'garbage' })], new Set(), '2026-11').entries).toEqual([]);
  });
});

describe('resumeItem', () => {
  it('does not backfill months spent paused', () => {
    const resumed = resumeItem(item({ active: false, nextMonth: '2026-06' }), '2026-11');
    expect(resumed).toMatchObject({ active: true, nextMonth: '2026-11' });
    expect(planRecurring([resumed], new Set(), '2026-11').entries.map((e) => e.id)).toEqual(['rec:gym:2026-11']);
  });

  it('keeps a cursor that is already ahead', () => {
    expect(resumeItem(item({ active: false, nextMonth: '2026-12' }), '2026-11').nextMonth).toBe('2026-12');
  });
});

describe('generatedKeyFromEntryId', () => {
  it('recovers the key from generated ids only', () => {
    expect(generatedKeyFromEntryId('rec:abc-123:2026-11')).toBe('abc-123:2026-11');
    expect(generatedKeyFromEntryId('b6e1c7')).toBeNull();
  });
});
