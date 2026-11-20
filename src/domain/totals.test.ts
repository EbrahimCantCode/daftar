import { describe, expect, it } from 'vitest';
import type { Entry } from './types';
import { breakdown, groupByDay, leftOf, outgoing, savingsBalance, totalsOf } from './totals';

let seq = 0;
const e = (date: string, amountFils: number, description: string, type: Entry['type'] = 'spend'): Entry => ({
  id: `e${++seq}`,
  date,
  amountFils,
  description,
  type,
  createdAt: seq,
});

const sample = [
  e('2026-11-01', 250_000, 'Savings', 'savings'),
  e('2026-11-05', 25_000, 'Gym', 'fixed'),
  e('2026-11-20', 6_500, 'Claude subscription', 'fixed'),
  e('2026-11-03', 1_200, 'Karak'),
  e('2026-11-03', 3_750, 'Lunch'),
  e('2026-11-12', 1_200, 'karak '),
  e('2026-10-31', 99_999, 'Last month'),
];

const nov = sample.filter((x) => x.date.startsWith('2026-11'));

describe('totalsOf', () => {
  it('sums each type in integer fils', () => {
    expect(totalsOf(nov)).toEqual({
      incomeFils: 0,
      withdrawnFils: 0,
      fixedFils: 31_500,
      spentFils: 6_150,
      savedFils: 250_000,
      totalOutFils: 287_650,
      netSavedFils: 250_000,
    });
  });

  it('counts income separately from spending', () => {
    const t = totalsOf([...nov, e('2026-11-01', 850_000, 'Salary', 'income')]);
    expect(t.incomeFils).toBe(850_000);
    expect(t.spentFils).toBe(6_150);
    expect(t.totalOutFils).toBe(287_650);
  });

  it('is zero for an empty period', () => {
    expect(totalsOf([])).toEqual({ incomeFils: 0, withdrawnFils: 0, fixedFils: 0, spentFils: 0, savedFils: 0, totalOutFils: 0, netSavedFils: 0 });
  });

  it('computes what is left, negative when overspent, and nothing without income', () => {
    expect(leftOf(totalsOf(nov))).toBeUndefined();
    expect(leftOf(totalsOf([...nov, e('2026-11-01', 800_000, 'Salary', 'income')]))).toBe(512_350);
    expect(leftOf(totalsOf([...nov, e('2026-11-01', 200_000, 'Salary', 'income')]))).toBe(-87_650);
  });

  it('stays exact where floats would drift', () => {
    const many = Array.from({ length: 1000 }, () => e('2026-11-01', 100, 'x'));
    expect(totalsOf(many).spentFils).toBe(100_000);
  });

  it('separates outgoing entries from income and withdrawals', () => {
    expect(outgoing([...nov, e('2026-11-01', 1, 'Salary', 'income'), e('2026-11-02', 1, 'Car', 'withdrawal')])).toHaveLength(6);
  });

  it('adds withdrawals to what is left and takes them off net saved', () => {
    const t = totalsOf([...nov, e('2026-11-01', 300_000, 'Salary', 'income'), e('2026-11-10', 100_000, 'Car repair', 'withdrawal')]);
    expect(t.withdrawnFils).toBe(100_000);
    expect(t.totalOutFils).toBe(287_650); // a withdrawal is not spending
    expect(leftOf(t)).toBe(300_000 + 100_000 - 287_650);
    expect(t.netSavedFils).toBe(150_000);
    const heavy = totalsOf([e('2026-11-01', 20_000, 'Savings', 'savings'), e('2026-11-09', 50_000, 'Flight', 'withdrawal')]);
    expect(heavy.netSavedFils).toBe(-30_000);
  });
});

describe('savingsBalance', () => {
  const entries = [
    e('2026-09-26', 200_000, 'Savings', 'savings'),
    e('2026-10-26', 200_000, 'Savings', 'savings'),
    e('2026-11-10', 150_000, 'Car repair', 'withdrawal'),
    e('2026-11-11', 5_000, 'Lunch'),
  ];
  it('adds savings and subtracts withdrawals up to a date', () => {
    expect(savingsBalance(entries, 1_000_000, '2026-09-25')).toBe(1_000_000);
    expect(savingsBalance(entries, 1_000_000, '2026-10-26')).toBe(1_400_000);
    expect(savingsBalance(entries, 1_000_000, '2026-11-30')).toBe(1_250_000);
  });
  it('can go below zero when nothing was there to start with', () => {
    expect(savingsBalance([e('2026-11-10', 50_000, 'x', 'withdrawal')], 0, '2026-11-30')).toBe(-50_000);
  });
});

describe('groupByDay', () => {
  it('groups newest day first with day totals', () => {
    const groups = groupByDay(nov);
    expect(groups.map((g) => g.date)).toEqual(['2026-11-20', '2026-11-12', '2026-11-05', '2026-11-03', '2026-11-01']);
    const third = groups.find((g) => g.date === '2026-11-03')!;
    expect(third.totalFils).toBe(4_950);
    expect(third.entries.map((x) => x.description)).toEqual(['Lunch', 'Karak']);
  });
});

describe('breakdown', () => {
  it('groups descriptions case-insensitively and trimmed', () => {
    const rows = breakdown(nov);
    const karak = rows.find((r) => r.key === 'karak')!;
    expect(karak).toMatchObject({ totalFils: 2_400, count: 2 });
    expect(rows[0]?.label).toBe('Savings');
  });

  it('folds the tail into Other', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((d, i) => e('2026-11-01', (10 - i) * 1000, d));
    const rows = breakdown(many, 5);
    expect(rows).toHaveLength(6);
    expect(rows[5]).toMatchObject({ label: 'Other (2)', totalFils: 9_000, count: 2 });
  });

  it('does not fold a single leftover row', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((d) => e('2026-11-01', 1000, d));
    expect(breakdown(six, 5).map((r) => r.label)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});
