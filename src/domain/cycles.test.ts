import { describe, expect, it } from 'vitest';
import type { Entry } from './types';
import {
  buildCycleContext,
  cycleByKey,
  cycleFor,
  cycleLength,
  cycleName,
  cycleRange,
  cycleTitle,
  cyclesBetween,
  cyclesWithData,
  daysElapsed,
  entriesInCycle,
  expectedPayday,
  salaryCycleKey,
  salaryDueCycle,
} from './cycles';

let seq = 0;
const salary = (date: string, isSalary = true): Entry => ({
  id: `s${++seq}`,
  date,
  amountFils: 850_000,
  description: 'Salary',
  type: 'income',
  salary: isSalary,
  createdAt: seq,
});
const spend = (date: string): Entry => ({ id: `x${++seq}`, date, amountFils: 1_000, description: 'x', type: 'spend', createdAt: seq });

const ctx26 = (entries: Entry[] = []) => buildCycleContext(entries, 26);

describe('cycles with payday on the 26th', () => {
  it('runs from payday to the day before the next payday when no salary is logged', () => {
    expect(cycleByKey('2026-11', ctx26())).toEqual({ key: '2026-11', payday: '2026-10-26', start: '2026-10-26', end: '2026-11-25' });
  });

  it('is named after the month it mostly covers', () => {
    const c = cycleFor('2026-10-30', ctx26());
    expect(c.key).toBe('2026-11');
    expect(cycleTitle(c, '2026-11-21')).toBe('November (26 Oct – 25 Nov)');
  });

  it('starts on the salary date when the salary comes up to 7 days early', () => {
    const ctx = ctx26([salary('2026-10-22')]);
    expect(cycleByKey('2026-11', ctx)).toMatchObject({ start: '2026-10-22', end: '2026-11-25', salaryDate: '2026-10-22' });
    // The previous cycle ends the day before.
    expect(cycleByKey('2026-10', ctx).end).toBe('2026-10-21');
    expect(cycleFor('2026-10-23', ctx).key).toBe('2026-11');
  });

  it('accepts a salary exactly 7 days early but not 8', () => {
    expect(salaryCycleKey('2026-10-19', 26)).toBe('2026-11');
    expect(salaryCycleKey('2026-10-18', 26)).toBe('2026-10');
    // 8 days early is plain income in the old cycle: the new cycle still starts on payday.
    expect(cycleByKey('2026-11', ctx26([salary('2026-10-18')])).start).toBe('2026-10-26');
  });

  it('starts late when the salary arrives after payday', () => {
    const ctx = ctx26([salary('2026-10-28')]);
    expect(cycleByKey('2026-11', ctx).start).toBe('2026-10-28');
    expect(cycleByKey('2026-10', ctx).end).toBe('2026-10-27');
  });

  it('uses the earliest of two salaries in one window', () => {
    expect(cycleByKey('2026-11', ctx26([salary('2026-10-27'), salary('2026-10-24')])).start).toBe('2026-10-24');
  });

  it('ignores income that is not a salary', () => {
    expect(cycleByKey('2026-11', ctx26([salary('2026-10-22', false)])).start).toBe('2026-10-26');
  });

  it('crosses the year boundary', () => {
    const jan = cycleFor('2027-01-02', ctx26());
    expect(jan).toMatchObject({ key: '2027-01', start: '2026-12-26', end: '2027-01-25' });
    expect(cycleRange(jan)).toBe('26 Dec 2026 – 25 Jan 2027');
    expect(cycleName(jan, '2026-12-30')).toBe('January 2027');
    expect(cycleName(jan, '2027-01-02')).toBe('January');
    expect(cycleFor('2026-12-25', ctx26()).key).toBe('2026-12');
  });

  it('lists consecutive cycles without gaps or overlaps', () => {
    const list = cyclesBetween('2026-01', '2027-03', ctx26([salary('2026-02-20'), salary('2026-07-29')]));
    expect(list).toHaveLength(15);
    for (let i = 1; i < list.length; i++) {
      const [y, m, d] = list[i - 1]!.end.split('-').map(Number) as [number, number, number];
      const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
      expect(list[i]!.start).toBe(next);
    }
  });

  it('counts length and elapsed days', () => {
    const c = cycleByKey('2026-11', ctx26());
    expect(cycleLength(c)).toBe(31);
    expect(daysElapsed(c, '2026-10-26')).toBe(1);
    expect(daysElapsed(c, '2026-11-21')).toBe(27);
    expect(daysElapsed(c, '2026-12-05')).toBe(31);
    expect(daysElapsed(c, '2026-10-01')).toBe(0);
  });

  it('selects entries by date', () => {
    const c = cycleByKey('2026-11', ctx26());
    expect(entriesInCycle([spend('2026-10-25'), spend('2026-10-26'), spend('2026-11-25'), spend('2026-11-26')], c).map((e) => e.date)).toEqual([
      '2026-10-26',
      '2026-11-25',
    ]);
  });
});

describe('other paydays', () => {
  it('clamps payday 31 to the end of short months', () => {
    const ctx = buildCycleContext([], 31);
    expect(expectedPayday('2026-03', 31)).toBe('2026-02-28');
    expect(cycleByKey('2026-03', ctx)).toMatchObject({ start: '2026-02-28', end: '2026-03-30' });
    expect(cycleByKey('2028-03', ctx).start).toBe('2028-02-29');
  });

  it('names cycles after their own month when payday is early in the month', () => {
    const ctx = buildCycleContext([], 1);
    expect(cycleFor('2026-11-15', ctx)).toMatchObject({ key: '2026-11', start: '2026-11-01', end: '2026-11-30' });
    expect(salaryCycleKey('2026-10-27', 1)).toBe('2026-11');
  });

  it('gives every month exactly one cycle name around February with a mid-month payday', () => {
    for (const day of [15, 16]) {
      const keys = cyclesBetween('2026-01', '2026-12', buildCycleContext([], day)).map((c) => c.key);
      expect(new Set(keys).size).toBe(12);
      expect(keys[1]).toBe('2026-02');
    }
  });
});

describe('salaryDueCycle', () => {
  it('asks for the next salary from 7 days before payday', () => {
    expect(salaryDueCycle('2026-11-18', ctx26())).toBeNull();
    expect(salaryDueCycle('2026-11-19', ctx26())).toBe('2026-12');
  });

  it('keeps asking in the first days of a cycle without a salary, then stops', () => {
    expect(salaryDueCycle('2026-11-26', ctx26())).toBe('2026-12');
    expect(salaryDueCycle('2026-12-05', ctx26())).toBe('2026-12');
    expect(salaryDueCycle('2026-12-06', ctx26())).toBeNull();
  });

  it('stops asking once the salary is logged, early or on time', () => {
    expect(salaryDueCycle('2026-11-22', ctx26([salary('2026-11-22')]))).toBeNull();
    expect(salaryDueCycle('2026-11-27', ctx26([salary('2026-11-26')]))).toBeNull();
  });
});

describe('cyclesWithData', () => {
  it('runs from the earliest entry to today', () => {
    const list = cyclesWithData([spend('2026-11-03'), spend('2026-09-30')], ctx26(), '2026-12-01');
    expect(list.map((c) => c.key)).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(cyclesWithData([], ctx26(), '2026-12-01')).toEqual([]);
  });
});
