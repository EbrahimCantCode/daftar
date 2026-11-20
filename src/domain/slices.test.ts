import { describe, expect, it } from 'vitest';
import type { Entry } from './types';
import { FIXED_KEY, OTHER_KEY, SAVED_KEY, chartEntries, sliceAngles, slicesOf } from './slices';

let seq = 0;
const e = (amountFils: number, description: string, type: Entry['type'] = 'spend'): Entry => ({
  id: `e${++seq}`,
  date: '2026-11-01',
  amountFils,
  description,
  type,
  createdAt: seq,
});

const sample = [
  e(5_000, 'Coffee'),
  e(2_000, ' coffee'),
  e(40_000, 'Groceries'),
  e(25_000, 'Gym', 'fixed'),
  e(200_000, 'Savings', 'savings'),
  e(850_000, 'Salary', 'income'),
  e(100_000, 'Car', 'withdrawal'),
];

describe('slicesOf', () => {
  it('groups spending by description, biggest first', () => {
    const slices = slicesOf(sample, 'spend');
    expect(slices.map((s) => [s.label, s.totalFils, s.count])).toEqual([
      ['Groceries', 40_000, 1],
      ['coffee', 7_000, 2], // two spellings, used once each: the latest wins
    ]);
    expect(slices[1]?.entries).toHaveLength(2);
  });

  it('adds Fixed and Saved as their own slices for everything out', () => {
    const slices = slicesOf(sample, 'all');
    expect(slices.map((s) => s.key)).toEqual([SAVED_KEY, 'groceries', FIXED_KEY, 'coffee']);
    expect(slices[0]).toMatchObject({ label: 'Saved', type: 'savings', totalFils: 200_000 });
  });

  it('keeps the top 7 and folds the rest into Other, with their entries', () => {
    const many = Array.from({ length: 10 }, (_, i) => e((10 - i) * 1_000, `Item ${i}`));
    const slices = slicesOf(many, 'spend');
    expect(slices).toHaveLength(8);
    expect(slices[7]).toMatchObject({ key: OTHER_KEY, label: 'Other (3)', totalFils: 6_000, count: 3 });
    expect(slices[7]?.entries).toHaveLength(3);
  });

  it('never includes income or withdrawals', () => {
    expect(chartEntries(sample, 'all').map((x) => x.type).sort()).toEqual(['fixed', 'savings', 'spend', 'spend', 'spend']);
  });
});

describe('sliceAngles', () => {
  it('covers the full circle starting at 12 o’clock', () => {
    const angles = sliceAngles(slicesOf(sample, 'spend'));
    expect(angles[0]!.start).toBeCloseTo(-Math.PI / 2);
    expect(angles[angles.length - 1]!.end).toBeCloseTo((Math.PI * 3) / 2);
  });

  it('keeps a sliver for tiny slices', () => {
    const angles = sliceAngles(slicesOf([e(1_000_000, 'Rent'), e(1, 'Gum')], 'spend'));
    expect(angles[1]!.end - angles[1]!.start).toBeGreaterThan(0.01);
  });
});
