import type { Entry, RecurringItem } from './types';
import { buildCycleContext, cycleByKey, cycleName, cyclesWithData, entriesInCycle, type Cycle } from './cycles';
import { DASH, byDateThenCreated, cell, longDate, mdTable, percent } from './markdown';
import { formatFils } from './money';
import { REPORT_FOOTER } from './report';
import { descriptionKey } from './text';
import { breakdown, leftOf, savingsBalance, totalsOf, type Totals } from './totals';

// Builds the Year Report: the cycles named after a year's months, summed and compared.

export interface YearReportInput {
  /** YYYY */
  year: string;
  entries: readonly Entry[];
  recurring: readonly RecurringItem[];
  paydayDay: number;
  startingSavingsFils?: number;
  today: string;
  includeEntries: boolean;
}

export const YEAR_REPORT_FOOTER = [
  REPORT_FOOTER,
  "A year covers the cycles named after that year's months, so its first cycle can start in December of the year before.",
  "'Savings rate' = net saved ÷ income.",
].join(' ');

/** "12%", "−4%", or "–" when there's no income to compare with. */
export function savingsRate(t: Totals): string {
  if (t.incomeFils <= 0) return DASH;
  const pct = Math.round((t.netSavedFils * 100) / t.incomeFils);
  return pct < 0 ? `−${-pct}%` : `${pct}%`;
}

/** Cycles of `year` that have entries, oldest first. Empty cycles (one just begun) would skew best and worst. */
export function yearCycles(entries: readonly Entry[], paydayDay: number, year: string, today: string): Cycle[] {
  const ctx = buildCycleContext(entries, paydayDay);
  return cyclesWithData(entries, ctx, today).filter(
    (c) => c.key.startsWith(`${year}-`) && c.start <= today && entries.some((e) => e.date >= c.start && e.date <= c.end),
  );
}

/** Years that have at least one cycle with data, newest first. */
export function reportYears(entries: readonly Entry[], paydayDay: number, today: string): string[] {
  const ctx = buildCycleContext(entries, paydayDay);
  const years = new Set(cyclesWithData(entries, ctx, today).map((c) => c.key.slice(0, 4)));
  return [...years].sort().reverse();
}

const signed = (fils: number) => (fils > 0 ? `+${formatFils(fils)}` : formatFils(fils));

interface CycleRow {
  cycle: Cycle;
  entries: Entry[];
  totals: Totals;
}

function summarySection(input: YearReportInput, rows: CycleRow[], all: Entry[]): string {
  const t = totalsOf(all);
  const left = leftOf(t);
  const table = mdTable(
    ['', 'Year'],
    [
      ['Income', formatFils(t.incomeFils)],
      ['From savings', formatFils(t.withdrawnFils)],
      ['Fixed', formatFils(t.fixedFils)],
      ['Spent', formatFils(t.spentFils)],
      ['Saved', formatFils(t.savedFils)],
      ['Total out', formatFils(t.totalOutFils)],
      ['Left', left === undefined ? DASH : formatFils(left)],
      ['Net saved', formatFils(t.netSavedFils)],
      ['Savings rate', savingsRate(t)],
    ],
  );
  const first = rows[0]!.cycle;
  const last = rows[rows.length - 1]!.cycle;
  const lines = [
    '## Summary',
    table,
    '',
    `- Cycles covered: ${rows.length} (${cycleName(first)} to ${cycleName(last)}, ${longDate(first.start)} – ${longDate(last.end)})`,
  ];
  if (t.netSavedFils < 0) lines.push(`- Savings went down over the year: ${formatFils(t.withdrawnFils)} came out and ${formatFils(t.savedFils)} went in.`);
  if (input.startingSavingsFils !== undefined) {
    const end = input.today < last.end ? input.today : last.end;
    const startBalance = savingsBalance(input.entries, input.startingSavingsFils, dayBefore(first.start));
    const endBalance = savingsBalance(input.entries, input.startingSavingsFils, end);
    lines.push(`- Savings balance at the start of the year: ${formatFils(startBalance)}`);
    const when = end === last.end ? `after ${cycleName(last)}` : 'so far';
    lines.push(`- Savings balance ${when}: ${formatFils(endBalance)} (${signed(endBalance - startBalance)})`);
  }
  return lines.join('\n');
}

function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

function cyclesSection(rows: CycleRow[]): string {
  const table = mdTable(
    ['Cycle', 'Dates', 'Income', 'From savings', 'Fixed', 'Spent', 'Saved', 'Net saved', 'Total out', 'Savings rate'],
    rows.map(({ cycle, totals: t }) => [
      cycleName(cycle),
      `${cycle.start} – ${cycle.end}`,
      formatFils(t.incomeFils),
      formatFils(t.withdrawnFils),
      formatFils(t.fixedFils),
      formatFils(t.spentFils),
      formatFils(t.savedFils),
      formatFils(t.netSavedFils),
      formatFils(t.totalOutFils),
      savingsRate(t),
    ]),
  );
  return ['## Cycle by cycle', table].join('\n');
}

function recordsSection(rows: CycleRow[]): string {
  if (rows.length < 2) return '## Best and worst\nOnly one cycle so far, so there is nothing to compare yet.';
  const by = (f: (r: CycleRow) => number, dir: 1 | -1) => rows.reduce((a, b) => (dir * (f(b) - f(a)) > 0 ? b : a));
  const best = by((r) => r.totals.netSavedFils, 1);
  const worst = by((r) => r.totals.netSavedFils, -1);
  const spendiest = by((r) => r.totals.spentFils, 1);
  return [
    '## Best and worst',
    `- Best cycle (net saved): ${cycleName(best.cycle)}, ${signed(best.totals.netSavedFils)}`,
    `- Worst cycle (net saved): ${cycleName(worst.cycle)}, ${signed(worst.totals.netSavedFils)}`,
    `- Highest-spending cycle: ${cycleName(spendiest.cycle)}, ${formatFils(spendiest.totals.spentFils)} spent`,
  ].join('\n');
}

function whereSection(rows: CycleRow[], all: Entry[]): string {
  const spend = all.filter((e) => e.type === 'spend');
  const spent = spend.reduce((s, e) => s + e.amountFils, 0);
  if (spent === 0) return '## Where the money went\nNo spending this year.';
  const cyclesOf = new Map<string, Set<string>>();
  for (const { cycle, entries } of rows) {
    for (const e of entries) {
      if (e.type !== 'spend') continue;
      const key = descriptionKey(e.description);
      if (!cyclesOf.has(key)) cyclesOf.set(key, new Set());
      cyclesOf.get(key)!.add(cycle.key);
    }
  }
  const table = breakdown(spend, 15).map((r) => [
    cell(r.label),
    String(r.count),
    formatFils(r.totalFils),
    percent(r.totalFils, spent),
    cyclesOf.get(r.key)?.size.toString() ?? DASH,
  ]);
  return ['## Where the money went', 'Top 15 descriptions by total spent.', '', mdTable(['Description', 'Times', 'Total', '% of Spent', 'Cycles'], table)].join(
    '\n',
  );
}

function fixedSection(rows: CycleRow[], recurring: readonly RecurringItem[]): string {
  const names = new Map(recurring.map((r) => [r.id, r.name]));
  const groups = new Map<string, { name: string; total: number; count: number; changes: string[]; last?: number }>();
  for (const { cycle, entries } of rows) {
    for (const e of [...entries].sort(byDateThenCreated)) {
      if (e.type !== 'fixed') continue;
      const key = e.recurringId ?? `one-off:${descriptionKey(e.description)}`;
      let g = groups.get(key);
      if (!g) {
        g = { name: (e.recurringId && names.get(e.recurringId)) || e.description, total: 0, count: 0, changes: [] };
        groups.set(key, g);
      }
      if (g.last !== undefined && g.last !== e.amountFils) {
        g.changes.push(`${formatFils(g.last)} → ${formatFils(e.amountFils)} from ${cycleName(cycle)}`);
      }
      g.last = e.amountFils;
      g.total += e.amountFils;
      g.count++;
    }
  }
  if (!groups.size) return '## Fixed costs\nNone this year.';
  const table = mdTable(
    ['Item', 'Times', 'Total', 'Changes'],
    [...groups.values()].sort((a, b) => b.total - a.total).map((g) => [cell(g.name), String(g.count), formatFils(g.total), g.changes.join('; ') || DASH]),
  );
  return ['## Fixed costs', table].join('\n');
}

function withdrawalsSection(all: Entry[]): string {
  const list = all.filter((e) => e.type === 'withdrawal').sort(byDateThenCreated);
  if (!list.length) return '## Savings withdrawals\nNone this year.';
  const rows = list.map((e) => [e.date, cell(e.description), formatFils(e.amountFils)]);
  rows.push(['', 'Total', formatFils(list.reduce((s, e) => s + e.amountFils, 0))]);
  return ['## Savings withdrawals', mdTable(['Date', 'Reason', 'Amount'], rows)].join('\n');
}

function entriesSection(all: Entry[]): string {
  const rows = [...all].sort(byDateThenCreated).map((e) => [e.date, cell(e.description), e.type, formatFils(e.amountFils)]);
  return ['## All entries', mdTable(['Date', 'Description', 'Type', 'Amount'], rows)].join('\n');
}

export function buildYearReport(input: YearReportInput): string {
  const ctx = buildCycleContext(input.entries, input.paydayDay);
  const cycles = yearCycles(input.entries, input.paydayDay, input.year, input.today).map((c) => cycleByKey(c.key, ctx));
  const header = `# Daftar: Year Report, ${input.year}\nGenerated: ${longDate(input.today)}. Currency: BHD.`;
  const footer = `## Notes for analysis\n${YEAR_REPORT_FOOTER}`;
  if (!cycles.length) return [header, `No entries in the cycles named after ${input.year}'s months.`, footer].join('\n\n') + '\n';

  const rows: CycleRow[] = cycles.map((cycle) => {
    const entries = entriesInCycle(input.entries, cycle);
    return { cycle, entries, totals: totalsOf(entries) };
  });
  const all = rows.flatMap((r) => r.entries);
  const sections = [
    header,
    summarySection(input, rows, all),
    cyclesSection(rows),
    recordsSection(rows),
    whereSection(rows, all),
    fixedSection(rows, input.recurring),
    withdrawalsSection(all),
  ];
  if (input.includeEntries) sections.push(entriesSection(all));
  sections.push(footer);
  return sections.join('\n\n') + '\n';
}
