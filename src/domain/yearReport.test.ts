import { describe, expect, it } from 'vitest';
import type { Entry, RecurringItem } from './types';
import { buildYearReport, reportYears, savingsRate, yearCycles, type YearReportInput } from './yearReport';
import { totalsOf } from './totals';

let seq = 0;
const e = (date: string, amountFils: number, description: string, type: Entry['type'] = 'spend', recurringId?: string): Entry => ({
  id: `e${++seq}`,
  date,
  amountFils,
  description,
  type,
  createdAt: seq,
  ...(recurringId ? { recurringId } : {}),
  ...(type === 'income' ? { salary: true } : {}),
});

const gym: RecurringItem = {
  id: 'gym',
  name: 'Gym',
  amountFils: 30_000,
  timing: 'day',
  dayOfMonth: 5,
  type: 'fixed',
  active: true,
  nextCycle: '2027-04',
  createdAt: 0,
};

const entries = [
  // December 2026 cycle (26 Nov – 25 Dec 2026): not part of 2027.
  e('2026-11-26', 850_000, 'Salary', 'income'),
  e('2026-11-26', 200_000, 'Savings', 'savings'),
  e('2026-12-10', 10_000, 'Coffee'),
  // January 2027 cycle (26 Dec 2026 – 25 Jan 2027)
  e('2026-12-26', 850_000, 'Salary', 'income'),
  e('2026-12-26', 200_000, 'Savings', 'savings'),
  e('2027-01-05', 25_000, 'Gym', 'fixed', 'gym'),
  e('2026-12-27', 2_000, 'Coffee'),
  e('2027-01-10', 20_000, 'Groceries'),
  // February 2027 cycle
  e('2027-01-26', 850_000, 'Salary', 'income'),
  e('2027-01-26', 200_000, 'Savings', 'savings'),
  e('2027-02-05', 30_000, 'Gym', 'fixed', 'gym'),
  e('2027-02-01', 3_000, 'coffee '),
  e('2027-02-10', 100_000, 'Car | repair', 'withdrawal'),
  e('2027-02-11', 150_000, 'Car repair'),
  // March 2027 cycle
  e('2027-02-26', 850_000, 'Salary', 'income'),
  e('2027-02-26', 200_000, 'Savings', 'savings'),
  e('2027-03-05', 30_000, 'Gym', 'fixed', 'gym'),
  e('2027-03-03', 2_500, 'Coffee'),
];

const base: YearReportInput = {
  year: '2027',
  entries,
  recurring: [gym],
  paydayDay: 26,
  startingSavingsFils: 1_000_000,
  today: '2027-03-30',
  includeEntries: false,
};

describe('yearCycles', () => {
  it("takes the cycles named after the year's months that have entries", () => {
    expect(yearCycles(entries, 26, '2027', '2027-03-30').map((c) => c.key)).toEqual(['2027-01', '2027-02', '2027-03']);
    expect(yearCycles(entries, 26, '2026', '2027-03-30').map((c) => c.key)).toEqual(['2026-12']);
  });

  it('lists report years newest first', () => {
    expect(reportYears(entries, 26, '2027-03-30')).toEqual(['2027', '2026']);
  });
});

describe('savingsRate', () => {
  it('divides net saved by income, and needs income', () => {
    expect(savingsRate(totalsOf([e('2027-01-01', 1_000, 'x', 'income'), e('2027-01-02', 250, 'x', 'savings')]))).toBe('25%');
    expect(savingsRate(totalsOf([e('2027-01-01', 1_000, 'x', 'income'), e('2027-01-02', 250, 'x', 'withdrawal')]))).toBe('−25%');
    expect(savingsRate(totalsOf([e('2027-01-02', 250, 'x', 'savings')]))).toBe('–');
  });
});

describe('buildYearReport', () => {
  it('produces the full report', () => {
    expect(buildYearReport(base)).toMatchInlineSnapshot(`
      "# Daftar: Year Report, 2027
      Generated: 30 Mar 2027. Currency: BHD.

      ## Summary
      |  | Year |
      |---|---|
      | Income | 2,550.000 BD |
      | From savings | 100.000 BD |
      | Fixed | 85.000 BD |
      | Spent | 177.500 BD |
      | Saved | 600.000 BD |
      | Total out | 862.500 BD |
      | Left | 1,787.500 BD |
      | Net saved | 500.000 BD |
      | Savings rate | 20% |

      - Cycles covered: 3 (January to March, 26 Dec 2026 – 25 Mar 2027)
      - Savings balance at the start of the year: 1,200.000 BD
      - Savings balance after March: 1,700.000 BD (+500.000 BD)

      ## Cycle by cycle
      | Cycle | Dates | Income | From savings | Fixed | Spent | Saved | Net saved | Total out | Savings rate |
      |---|---|---|---|---|---|---|---|---|---|
      | January | 2026-12-26 – 2027-01-25 | 850.000 BD | 0.000 BD | 25.000 BD | 22.000 BD | 200.000 BD | 200.000 BD | 247.000 BD | 24% |
      | February | 2027-01-26 – 2027-02-25 | 850.000 BD | 100.000 BD | 30.000 BD | 153.000 BD | 200.000 BD | 100.000 BD | 383.000 BD | 12% |
      | March | 2027-02-26 – 2027-03-25 | 850.000 BD | 0.000 BD | 30.000 BD | 2.500 BD | 200.000 BD | 200.000 BD | 232.500 BD | 24% |

      ## Best and worst
      - Best cycle (net saved): January, +200.000 BD
      - Worst cycle (net saved): February, +100.000 BD
      - Highest-spending cycle: February, 153.000 BD spent

      ## Where the money went
      Top 15 descriptions by total spent.

      | Description | Times | Total | % of Spent | Cycles |
      |---|---|---|---|---|
      | Car repair | 1 | 150.000 BD | 85% | 1 |
      | Groceries | 1 | 20.000 BD | 11% | 1 |
      | Coffee | 3 | 7.500 BD | 4% | 3 |

      ## Fixed costs
      | Item | Times | Total | Changes |
      |---|---|---|---|
      | Gym | 3 | 85.000 BD | 25.000 BD → 30.000 BD from February |

      ## Savings withdrawals
      | Date | Reason | Amount |
      |---|---|---|
      | 2027-02-10 | Car \\| repair | 100.000 BD |
      |  | Total | 100.000 BD |

      ## Notes for analysis
      Amounts are in Bahraini Dinar. 'Fixed' = recurring monthly costs, 'Saved' = money moved to savings (not spending). 'From savings' = money taken out of savings to cover spending: it adds to what's available (Left = income + from savings − total out) and is subtracted from net saved (saved − from savings). Each month is a pay cycle: it runs from one salary to the day before the next, and is named after the month it mostly covers. A year covers the cycles named after that year's months, so its first cycle can start in December of the year before. 'Savings rate' = net saved ÷ income.
      "
    `);
  });

  it('sums the whole year', () => {
    const report = buildYearReport(base);
    expect(report).toContain('| Income | 2,550.000 BD |');
    expect(report).toContain('| From savings | 100.000 BD |');
    expect(report).toContain('| Spent | 177.500 BD |');
    expect(report).toContain('| Left | 1,787.500 BD |');
    expect(report).toContain('| Net saved | 500.000 BD |');
    expect(report).toContain('| Savings rate | 20% |');
  });

  it('names the best, worst and highest-spending cycles', () => {
    const report = buildYearReport(base);
    expect(report).toContain('- Best cycle (net saved): January, +200.000 BD');
    expect(report).toContain('- Worst cycle (net saved): February, +100.000 BD');
    expect(report).toContain('- Highest-spending cycle: February, 153.000 BD spent');
  });

  it('counts the cycles each description appeared in', () => {
    expect(buildYearReport(base)).toContain('| Coffee | 3 | 7.500 BD | 4% | 3 |');
  });

  it('totals fixed costs per item and notes amount changes', () => {
    expect(buildYearReport(base)).toContain('| Gym | 3 | 85.000 BD | 25.000 BD → 30.000 BD from February |');
  });

  it('lists withdrawals with reasons', () => {
    expect(buildYearReport(base)).toContain('| 2027-02-10 | Car \\| repair | 100.000 BD |');
  });

  it('shows the savings balance at the start and end of the year', () => {
    const report = buildYearReport(base);
    expect(report).toContain('- Savings balance at the start of the year: 1,200.000 BD');
    expect(report).toContain('- Savings balance after March: 1,700.000 BD (+500.000 BD)');
  });

  it('includes the entry list only when asked', () => {
    expect(buildYearReport(base)).not.toContain('## All entries');
    expect(buildYearReport({ ...base, includeEntries: true })).toContain('| 2026-12-26 | Salary | income | 850.000 BD |');
  });

  it('handles a year with no data', () => {
    const report = buildYearReport({ ...base, year: '2025' });
    expect(report).toContain("No entries in the cycles named after 2025's months.");
    expect(report).toContain('## Notes for analysis');
  });

  it('says there is nothing to compare with a single cycle', () => {
    expect(buildYearReport({ ...base, year: '2026' })).toContain('Only one cycle so far');
  });
});
