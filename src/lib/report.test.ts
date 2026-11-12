import { describe, expect, it } from 'vitest';
import type { Entry, RecurringItem } from '../types';
import { REPORT_FOOTER, buildMonthReport, change, daysCounted, weekBuckets, type ReportInput } from './report';

let seq = 0;
const e = (date: string, amountFils: number, description: string, type: Entry['type'] = 'spend', recurringId?: string): Entry => ({
  id: `e${++seq}`,
  date,
  amountFils,
  description,
  type,
  createdAt: seq,
  ...(recurringId ? { recurringId } : {}),
});

const gym: RecurringItem = {
  id: 'gym',
  name: 'Gym',
  amountFils: 25_000,
  dayOfMonth: 5,
  type: 'fixed',
  active: true,
  nextMonth: '2026-12',
  createdAt: Date.UTC(2026, 8, 15, 12),
};
const savings: RecurringItem = { ...gym, id: 'sav', name: 'Savings', amountFils: 200_000, dayOfMonth: 1, type: 'savings' };

const october = [
  e('2026-10-01', 200_000, 'Savings', 'savings', 'sav'),
  e('2026-10-05', 25_000, 'Gym', 'fixed', 'gym'),
  e('2026-10-03', 4_000, 'Lunch'),
  e('2026-10-20', 16_000, 'Groceries'),
];
const november = [
  e('2026-11-01', 200_000, 'Savings', 'savings', 'sav'),
  e('2026-11-05', 30_000, 'Gym', 'fixed', 'gym'),
  e('2026-11-02', 1_200, 'Karak'),
  e('2026-11-02', 3_750, 'Lunch | Saffron'),
  e('2026-11-09', 1_200, ' karak '),
  e('2026-11-11', 18_500, 'Groceries'),
  e('2026-11-30', 5, 'Tip'),
];

const base: ReportInput = {
  month: '2026-11',
  entries: [...october, ...november],
  recurring: [gym, savings],
  incomeFils: 850_000,
  today: '2026-12-01',
  includeEntries: true,
};

describe('buildMonthReport', () => {
  it('produces the full report', () => {
    expect(buildMonthReport(base)).toMatchInlineSnapshot(`
      "# Daftar: Month Report, November 2026
      Generated: 1 Dec 2026. Currency: BHD.

      ## Summary
      |  | This month | Last month | Change |
      |---|---|---|---|
      | Income | 850.000 BD | 850.000 BD | 0.000 BD |
      | Fixed | 30.000 BD | 25.000 BD | +5.000 BD (+20%) |
      | Spent | 24.655 BD | 20.000 BD | +4.655 BD (+23%) |
      | Saved | 200.000 BD | 200.000 BD | 0.000 BD |
      | Total out | 254.655 BD | 245.000 BD | +9.655 BD (+4%) |
      | Left | 595.345 BD | 605.000 BD | −9.655 BD (−2%) |

      - Number of spending entries: 5 (average 0.822 BD per day)
      - Biggest single expense: Groceries, 18.500 BD, 2026-11-11
      - Days with no spending: 26

      ## Fixed & savings
      - Savings (savings, 2026-11-01): 200.000 BD
      - Gym (fixed, 2026-11-05): 30.000 BD (usually 25.000 BD)

      ## Where the money went
      | Description | Times | Total | % of Spent |
      |---|---|---|---|
      | Groceries | 1 | 18.500 BD | 75% |
      | Lunch \\| Saffron | 1 | 3.750 BD | 15% |
      | karak | 2 | 2.400 BD | 10% |
      | Tip | 1 | 0.005 BD | 0% |

      ## Spending by week
      - Week 1 (1st–7th): 4.950 BD
      - Week 2 (8th–14th): 19.700 BD
      - Week 3 (15th–21st): 0.000 BD
      - Week 4 (22nd–28th): 0.000 BD
      - Days 29th–30th: 0.005 BD

      ## All entries
      | Date | Description | Type | Amount |
      |---|---|---|---|
      | 2026-11-01 | Savings | savings | 200.000 BD |
      | 2026-11-02 | Karak | spend | 1.200 BD |
      | 2026-11-02 | Lunch \\| Saffron | spend | 3.750 BD |
      | 2026-11-05 | Gym | fixed | 30.000 BD |
      | 2026-11-09 | karak | spend | 1.200 BD |
      | 2026-11-11 | Groceries | spend | 18.500 BD |
      | 2026-11-30 | Tip | spend | 0.005 BD |

      ## Notes for analysis
      Amounts are in Bahraini Dinar. 'Fixed' = recurring monthly costs, 'Saved' = money moved to savings (not spending).
      "
    `);
  });

  it('computes totals, Left and month-over-month change', () => {
    const report = buildMonthReport(base);
    expect(report).toContain('| Income | 850.000 BD | 850.000 BD | 0.000 BD |');
    expect(report).toContain('| Fixed | 30.000 BD | 25.000 BD | +5.000 BD (+20%) |');
    expect(report).toContain('| Spent | 24.655 BD | 20.000 BD | +4.655 BD (+23%) |');
    expect(report).toContain('| Saved | 200.000 BD | 200.000 BD | 0.000 BD |');
    expect(report).toContain('| Total out | 254.655 BD | 245.000 BD | +9.655 BD (+4%) |');
    expect(report).toContain('| Left | 595.345 BD | 605.000 BD | −9.655 BD (−2%) |');
  });

  it('drops Income and Left when income is not set', () => {
    const report = buildMonthReport({ ...base, incomeFils: undefined });
    expect(report).not.toContain('| Income |');
    expect(report).not.toContain('| Left |');
    expect(report).toContain('| Total out |');
  });

  it('shows dashes when last month has no data', () => {
    const report = buildMonthReport({ ...base, entries: november });
    expect(report).toContain('| Spent | 24.655 BD | – | – |');
    expect(report).toContain('| Income | 850.000 BD | – | – |');
  });

  it('handles an empty month', () => {
    const report = buildMonthReport({ ...base, month: '2026-09', entries: [], recurring: [] });
    expect(report).toContain('# Daftar: Month Report, September 2026');
    expect(report).toContain('| Total out | 0.000 BD | – | – |');
    expect(report).toContain('- Number of spending entries: 0 (average 0.000 BD per day)');
    expect(report).toContain('- Biggest single expense: –');
    expect(report).toContain('- Days with no spending: 30');
    expect(report).toContain('- None this month.');
    expect(report).toContain('No spending this month.');
    expect(report).toContain('No entries this month.');
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
    expect(report).toContain('| 2026-11-30 | Tip | spend | 0.005 BD |');
    expect(report).not.toMatch(/\d\.\d{1,2} BD|\d\.\d{4,} BD/);
  });

  it('escapes pipes in descriptions', () => {
    expect(buildMonthReport(base)).toContain('| Lunch \\| Saffron |');
  });

  it('notes recurring amounts that differ from usual', () => {
    const report = buildMonthReport(base);
    expect(report).toContain('- Gym (fixed, 2026-11-05): 30.000 BD (usually 25.000 BD)');
    expect(report).toContain('- Savings (savings, 2026-11-01): 200.000 BD\n');
  });

  it('lists active items with no entry this month and one-off planned entries', () => {
    const report = buildMonthReport({
      ...base,
      entries: [e('2026-11-03', 50_000, 'Emergency fund', 'savings'), e('2026-11-05', 25_000, 'Gym', 'fixed', 'gym')],
    });
    expect(report).toContain('- Emergency fund (savings, 2026-11-03): 50.000 BD (one-off)');
    expect(report).toContain('- Savings (savings): not recorded this month (usually 200.000 BD)');
  });

  it('can leave out the entry list', () => {
    const report = buildMonthReport({ ...base, includeEntries: false });
    expect(report).not.toContain('## All entries');
    expect(report).toContain('## Spending by week');
    expect(report).toContain('## Notes for analysis');
  });

  it('averages over the days so far in the current month', () => {
    const report = buildMonthReport({ ...base, today: '2026-11-10' });
    // Spend by Nov 10: 1.200 + 3.750 + 1.200 = 6.150 BD over 10 days. Spent days: 2nd, 9th.
    expect(report).toContain('- Number of spending entries: 5 (average 2.466 BD per day)');
    expect(report).toContain('- Days with no spending: 8');
  });

  it('picks the biggest single spend, ignoring fixed and savings', () => {
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

describe('daysCounted', () => {
  it('counts all, some, or none of the month', () => {
    expect(daysCounted('2026-10', '2026-11-12')).toBe(31);
    expect(daysCounted('2026-11', '2026-11-12')).toBe(12);
    expect(daysCounted('2026-12', '2026-11-12')).toBe(0);
  });
});

describe('weekBuckets', () => {
  const labels = (month: string) => weekBuckets([], month).map((b) => b.label);

  it('ends with the remaining days of the month', () => {
    expect(labels('2026-11')).toEqual(['Week 1 (1st–7th)', 'Week 2 (8th–14th)', 'Week 3 (15th–21st)', 'Week 4 (22nd–28th)', 'Days 29th–30th']);
    expect(labels('2026-10').at(-1)).toBe('Days 29th–31st');
    expect(labels('2028-02').at(-1)).toBe('Day 29th');
    expect(labels('2026-02')).toHaveLength(4);
  });

  it('puts spending in the right week', () => {
    const buckets = weekBuckets([e('2026-11-07', 1_000, 'a'), e('2026-11-08', 2_000, 'b'), e('2026-11-30', 3_000, 'c')], '2026-11');
    expect(buckets.map((b) => b.totalFils)).toEqual([1_000, 2_000, 0, 0, 3_000]);
  });
});
