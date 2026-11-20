import { describe, expect, it } from 'vitest';
import type { Entry, RecurringItem } from './types';
import { buildCycleContext, cycleByKey } from './cycles';
import { change } from './markdown';
import { REPORT_FOOTER, buildMonthReport, weekBuckets, type ReportInput } from './report';

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
  amountFils: 25_000,
  timing: 'day',
  dayOfMonth: 5,
  type: 'fixed',
  active: true,
  nextCycle: '2026-12',
  createdAt: Date.UTC(2026, 8, 10, 12),
};
const savings: RecurringItem = { ...gym, id: 'sav', name: 'Savings', amountFils: 200_000, timing: 'payday', type: 'savings' };

// October cycle: 26 Sep – 25 Oct. November cycle: 26 Oct – 25 Nov.
const october = [
  e('2026-09-26', 850_000, 'Salary', 'income'),
  e('2026-09-26', 200_000, 'Savings', 'savings', 'sav'),
  e('2026-10-05', 25_000, 'Gym', 'fixed', 'gym'),
  e('2026-10-03', 4_000, 'Lunch'),
  e('2026-10-20', 16_000, 'Groceries'),
];
const november = [
  e('2026-10-26', 850_000, 'Salary', 'income'),
  e('2026-10-26', 200_000, 'Savings', 'savings', 'sav'),
  e('2026-11-05', 30_000, 'Gym', 'fixed', 'gym'),
  e('2026-10-27', 1_200, 'Karak'),
  e('2026-10-27', 3_750, 'Lunch | Saffron'),
  e('2026-11-09', 1_200, ' karak '),
  e('2026-11-11', 18_500, 'Groceries'),
  e('2026-11-25', 5, 'Tip'),
];

const base: ReportInput = {
  cycleKey: '2026-11',
  entries: [...october, ...november],
  recurring: [gym, savings],
  paydayDay: 26,
  today: '2026-11-26',
  includeEntries: true,
};

describe('buildMonthReport', () => {
  it('produces the full report', () => {
    expect(buildMonthReport(base)).toMatchInlineSnapshot(`
      "# Daftar: Month Report, November 2026
      Generated: 26 Nov 2026. Cycle: 26 Oct 2026 – 25 Nov 2026. Currency: BHD.

      ## Summary
      |  | This cycle | Last cycle | Change |
      |---|---|---|---|
      | Income | 850.000 BD | 850.000 BD | 0.000 BD |
      | Fixed | 30.000 BD | 25.000 BD | +5.000 BD (+20%) |
      | Spent | 24.655 BD | 20.000 BD | +4.655 BD (+23%) |
      | Saved | 200.000 BD | 200.000 BD | 0.000 BD |
      | Total out | 254.655 BD | 245.000 BD | +9.655 BD (+4%) |
      | Left | 595.345 BD | 605.000 BD | −9.655 BD (−2%) |

      - Number of spending entries: 5 (average 0.795 BD per day)
      - Biggest single expense: Groceries, 18.500 BD, 2026-11-11
      - Days with no spending: 27

      ## Fixed & savings
      - Savings (savings, 2026-10-26): 200.000 BD
      - Gym (fixed, 2026-11-05): 30.000 BD (usually 25.000 BD)

      ## Where the money went
      | Description | Times | Total | % of Spent |
      |---|---|---|---|
      | Groceries | 1 | 18.500 BD | 75% |
      | Lunch \\| Saffron | 1 | 3.750 BD | 15% |
      | karak | 2 | 2.400 BD | 10% |
      | Tip | 1 | 0.005 BD | 0% |

      ## Spending by week
      - Week 1 (26 Oct – 1 Nov): 4.950 BD
      - Week 2 (2 Nov – 8 Nov): 0.000 BD
      - Week 3 (9 Nov – 15 Nov): 19.700 BD
      - Week 4 (16 Nov – 22 Nov): 0.000 BD
      - Remaining days (23 Nov – 25 Nov): 0.005 BD

      ## All entries
      | Date | Description | Type | Amount |
      |---|---|---|---|
      | 2026-10-26 | Salary | income | 850.000 BD |
      | 2026-10-26 | Savings | savings | 200.000 BD |
      | 2026-10-27 | Karak | spend | 1.200 BD |
      | 2026-10-27 | Lunch \\| Saffron | spend | 3.750 BD |
      | 2026-11-05 | Gym | fixed | 30.000 BD |
      | 2026-11-09 | karak | spend | 1.200 BD |
      | 2026-11-11 | Groceries | spend | 18.500 BD |
      | 2026-11-25 | Tip | spend | 0.005 BD |

      ## Notes for analysis
      Amounts are in Bahraini Dinar. 'Fixed' = recurring monthly costs, 'Saved' = money moved to savings (not spending). Each month is a pay cycle: it runs from one salary to the day before the next, and is named after the month it mostly covers.
      "
    `);
  });

  it('computes totals, Left and change from the previous cycle', () => {
    const report = buildMonthReport(base);
    expect(report).toContain('| Income | 850.000 BD | 850.000 BD | 0.000 BD |');
    expect(report).toContain('| Fixed | 30.000 BD | 25.000 BD | +5.000 BD (+20%) |');
    expect(report).toContain('| Spent | 24.655 BD | 20.000 BD | +4.655 BD (+23%) |');
    expect(report).toContain('| Saved | 200.000 BD | 200.000 BD | 0.000 BD |');
    expect(report).toContain('| Total out | 254.655 BD | 245.000 BD | +9.655 BD (+4%) |');
    expect(report).toContain('| Left | 595.345 BD | 605.000 BD | −9.655 BD (−2%) |');
  });

  it('names the cycle and its dates', () => {
    expect(buildMonthReport(base)).toContain(
      '# Daftar: Month Report, November 2026\nGenerated: 26 Nov 2026. Cycle: 26 Oct 2026 – 25 Nov 2026. Currency: BHD.',
    );
  });

  it('drops Income and Left when no income was logged in either cycle', () => {
    const noIncome = base.entries.filter((x) => x.type !== 'income');
    const report = buildMonthReport({ ...base, entries: noIncome });
    expect(report).not.toContain('| Income |');
    expect(report).not.toContain('| Left |');
    expect(report).toContain('| Total out |');
  });

  it('shows dashes for a cycle without income', () => {
    const report = buildMonthReport({ ...base, entries: [...october.filter((x) => x.type !== 'income'), ...november] });
    expect(report).toContain('| Income | 850.000 BD | 0.000 BD | +850.000 BD |');
    expect(report).toContain('| Left | 595.345 BD | – | – |');
  });

  it('shows dashes when the last cycle has no data', () => {
    const report = buildMonthReport({ ...base, entries: november });
    expect(report).toContain('| Spent | 24.655 BD | – | – |');
    expect(report).toContain('| Income | 850.000 BD | – | – |');
  });

  it('handles an empty cycle', () => {
    const report = buildMonthReport({ ...base, cycleKey: '2026-09', entries: [], recurring: [] });
    expect(report).toContain('# Daftar: Month Report, September 2026');
    expect(report).toContain('| Total out | 0.000 BD | – | – |');
    expect(report).toContain('- Number of spending entries: 0 (average 0.000 BD per day)');
    expect(report).toContain('- Biggest single expense: –');
    expect(report).toContain('- Days with no spending: 31');
    expect(report).toContain('- None this cycle.');
    expect(report).toContain('No spending this cycle.');
    expect(report).toContain('No entries this cycle.');
    expect(report.trimEnd().endsWith(REPORT_FOOTER)).toBe(true);
  });

  it('groups descriptions case-insensitively and trimmed', () => {
    const report = buildMonthReport(base);
    // "Karak" and " karak " are one group; ties go to the most recent spelling.
    expect(report).toContain('| karak | 2 | 2.400 BD | 10% |');
    expect(report.match(/karak \| \d/gi)).toHaveLength(1);
  });

  it('formats every amount with 3 decimals', () => {
    const report = buildMonthReport(base);
    expect(report).toContain('| 2026-11-25 | Tip | spend | 0.005 BD |');
    expect(report).not.toMatch(/\d\.\d{1,2} BD|\d\.\d{4,} BD/);
  });

  it('escapes pipes in descriptions', () => {
    expect(buildMonthReport(base)).toContain('| Lunch \\| Saffron |');
  });

  it('notes recurring amounts that differ from usual', () => {
    const report = buildMonthReport(base);
    expect(report).toContain('- Gym (fixed, 2026-11-05): 30.000 BD (usually 25.000 BD)');
    expect(report).toContain('- Savings (savings, 2026-10-26): 200.000 BD\n');
  });

  it('lists active items with no entry this cycle and one-off planned entries', () => {
    const report = buildMonthReport({
      ...base,
      entries: [e('2026-11-03', 50_000, 'Emergency fund', 'savings'), e('2026-11-05', 25_000, 'Gym', 'fixed', 'gym')],
    });
    expect(report).toContain('- Emergency fund (savings, 2026-11-03): 50.000 BD (one-off)');
    expect(report).toContain('- Savings (savings): not recorded this cycle (usually 200.000 BD)');
  });

  it('can leave out the entry list', () => {
    const report = buildMonthReport({ ...base, includeEntries: false });
    expect(report).not.toContain('## All entries');
    expect(report).toContain('## Spending by week');
    expect(report).toContain('## Notes for analysis');
  });

  it('averages over the days so far in the current cycle', () => {
    const report = buildMonthReport({ ...base, today: '2026-11-09' });
    // 26 Oct – 9 Nov is 15 days; 24.655 BD spent in the cycle; spending on 27 Oct and 9 Nov.
    expect(report).toContain('- Number of spending entries: 5 (average 1.644 BD per day)');
    expect(report).toContain('- Days with no spending: 13');
  });

  it('picks the biggest single spend, ignoring fixed, savings and income', () => {
    expect(buildMonthReport(base)).toContain('- Biggest single expense: Groceries, 18.500 BD, 2026-11-11');
  });
});

describe('change', () => {
  it('signs differences and adds a percentage when possible', () => {
    expect(change(12_500, 10_000)).toBe('+2.500 BD (+25%)');
    expect(change(7_500, 10_000)).toBe('−2.500 BD (−25%)');
    expect(change(5_000, 0)).toBe('+5.000 BD');
    expect(change(5_000, 5_000)).toBe('0.000 BD');
  });
});

describe('weekBuckets', () => {
  const ctx = buildCycleContext([], 26);

  it('counts 7-day weeks from the cycle start, then the remaining days', () => {
    expect(weekBuckets([], cycleByKey('2026-11', ctx)).map((b) => b.label)).toEqual([
      'Week 1 (26 Oct – 1 Nov)',
      'Week 2 (2 Nov – 8 Nov)',
      'Week 3 (9 Nov – 15 Nov)',
      'Week 4 (16 Nov – 22 Nov)',
      'Remaining days (23 Nov – 25 Nov)',
    ]);
    // 26 Jan – 25 Feb 2026 is 31 days; 26 Feb – 25 Mar is 28: exactly four weeks.
    expect(weekBuckets([], cycleByKey('2026-03', ctx))).toHaveLength(4);
  });

  it('puts spending in the right week', () => {
    const buckets = weekBuckets([e('2026-11-01', 1_000, 'a'), e('2026-11-02', 2_000, 'b'), e('2026-11-25', 3_000, 'c')], cycleByKey('2026-11', ctx));
    expect(buckets.map((b) => b.totalFils)).toEqual([1_000, 2_000, 0, 0, 3_000]);
  });
});
