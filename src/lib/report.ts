import type { Entry, RecurringItem } from '../types';
import { addMonths, daysInMonth, monthLabel, monthOf, ordinal, todayISO } from './dates';
import { formatFils } from './money';
import { breakdown, entriesInMonth, leftThisMonth, monthTotals } from './totals';

// Builds the Month Report: a Markdown statement meant to be pasted into an AI chat.
// Everything is computed from integer fils and formatted with formatFils.

export interface ReportInput {
  /** YYYY-MM */
  month: string;
  /** All entries; the function picks this month and last month. */
  entries: readonly Entry[];
  recurring: readonly RecurringItem[];
  incomeFils?: number;
  /** YYYY-MM-DD, used for "Generated" and for how many days of the month have passed. */
  today: string;
  includeEntries: boolean;
}

const DASH = '–';
const MINUS = '−';

export const REPORT_FOOTER =
  "Amounts are in Bahraini Dinar. 'Fixed' = recurring monthly costs, 'Saved' = money moved to savings (not spending).";

function shortDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Escapes text for a Markdown table cell. */
function cell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function mdTable(header: string[], rows: string[][]): string {
  return [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/** "+1.250 BD (+12%)", "−0.500 BD (−4%)", or "0.000 BD". */
export function change(current: number, previous: number): string {
  const diff = current - previous;
  if (diff === 0) return formatFils(0);
  const sign = diff > 0 ? '+' : MINUS;
  let text = `${sign}${formatFils(Math.abs(diff))}`;
  if (previous !== 0) {
    const pct = Math.round((Math.abs(diff) * 100) / Math.abs(previous));
    if (pct > 0) text += ` (${sign}${pct}%)`;
  }
  return text;
}

/** Days of `month` that have happened by `today`: all of a past month, none of a future one. */
export function daysCounted(month: string, today: string): number {
  const current = monthOf(today);
  if (month < current) return daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  if (month > current) return 0;
  return Number(today.slice(8, 10));
}

export interface WeekBucket {
  label: string;
  totalFils: number;
}

/** Spend totals for days 1–7, 8–14, 15–21, 22–28, then whatever days remain. */
export function weekBuckets(spendEntries: readonly Entry[], month: string): WeekBucket[] {
  const lastDay = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const ranges: [string, number, number][] = [
    ['Week 1', 1, 7],
    ['Week 2', 8, 14],
    ['Week 3', 15, 21],
    ['Week 4', 22, 28],
  ];
  const buckets = ranges.map(([name, from, to]) => ({ from, to, label: `${name} (${ordinal(from)}–${ordinal(to)})`, totalFils: 0 }));
  if (lastDay > 28) {
    const label = lastDay === 29 ? `Day ${ordinal(29)}` : `Days ${ordinal(29)}–${ordinal(lastDay)}`;
    buckets.push({ from: 29, to: lastDay, label, totalFils: 0 });
  }
  for (const e of spendEntries) {
    const day = Number(e.date.slice(8, 10));
    const bucket = buckets.find((b) => day >= b.from && day <= b.to);
    if (bucket) bucket.totalFils += e.amountFils;
  }
  return buckets.map(({ label, totalFils }) => ({ label, totalFils }));
}

const byDateThenCreated = (a: Entry, b: Entry) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt);

function summarySection(input: ReportInput, thisEntries: Entry[], lastEntries: Entry[]): string {
  const now = monthTotals(thisEntries);
  const prev = monthTotals(lastEntries);
  const hasLast = lastEntries.length > 0;
  const income = input.incomeFils;

  const row = (label: string, cur: number, last: number) =>
    hasLast ? [label, formatFils(cur), formatFils(last), change(cur, last)] : [label, formatFils(cur), DASH, DASH];

  const rows: string[][] = [];
  if (income !== undefined) rows.push(row('Income', income, income));
  rows.push(row('Fixed', now.fixedFils, prev.fixedFils));
  rows.push(row('Spent', now.spentFils, prev.spentFils));
  rows.push(row('Saved', now.savedFils, prev.savedFils));
  rows.push(row('Total out', now.totalOutFils, prev.totalOutFils));
  if (income !== undefined) rows.push(row('Left', leftThisMonth(income, now)!, leftThisMonth(income, prev)!));

  const spend = thisEntries.filter((e) => e.type === 'spend');
  const days = daysCounted(input.month, input.today);
  const average = days > 0 ? `average ${formatFils(Math.round(now.spentFils / days))} per day` : 'no days have passed yet';

  let biggest = DASH;
  const top = spend.reduce<Entry | undefined>((best, e) => (!best || e.amountFils > best.amountFils ? e : best), undefined);
  if (top) biggest = `${top.description}, ${formatFils(top.amountFils)}, ${top.date}`;

  const spendDays = new Set(spend.filter((e) => Number(e.date.slice(8, 10)) <= days).map((e) => e.date));
  const noSpendDays = days > 0 ? String(days - spendDays.size) : DASH;

  return [
    '## Summary',
    mdTable(['', 'This month', 'Last month', 'Change'], rows),
    '',
    `- Number of spending entries: ${spend.length} (${average})`,
    `- Biggest single expense: ${biggest}`,
    `- Days with no spending: ${noSpendDays}`,
  ].join('\n');
}

function fixedSection(input: ReportInput, thisEntries: Entry[]): string {
  const items = new Map(input.recurring.map((r) => [r.id, r]));
  const lines: string[] = [];
  const planned = thisEntries.filter((e) => e.type !== 'spend').sort(byDateThenCreated);
  for (const e of planned) {
    let note = '';
    const item = e.recurringId ? items.get(e.recurringId) : undefined;
    if (!e.recurringId) note = ' (one-off)';
    else if (item && item.amountFils !== e.amountFils) note = ` (usually ${formatFils(item.amountFils)})`;
    const kind = e.type === 'fixed' ? 'fixed' : 'savings';
    lines.push(`- ${e.description} (${kind}, ${e.date}): ${formatFils(e.amountFils)}${note}`);
  }

  // Active items that should have been written this month but weren't (e.g. deleted that month).
  const recorded = new Set(planned.map((e) => e.recurringId).filter(Boolean));
  const upTo = monthOf(input.today);
  for (const item of input.recurring) {
    const started = monthOf(todayISO(new Date(item.createdAt)));
    if (item.active && !recorded.has(item.id) && input.month >= started && input.month <= upTo) {
      lines.push(`- ${item.name} (${item.type}): not recorded this month (usually ${formatFils(item.amountFils)})`);
    }
  }

  return ['## Fixed & savings', lines.length ? lines.join('\n') : '- None this month.'].join('\n');
}

function whereSection(spend: Entry[], spentFils: number): string {
  if (spentFils === 0) return '## Where the money went\nNo spending this month.';
  const rows = breakdown(spend, 10).map((r) => [
    cell(r.label),
    String(r.count),
    formatFils(r.totalFils),
    `${Math.round((r.totalFils * 100) / spentFils)}%`,
  ]);
  return ['## Where the money went', mdTable(['Description', 'Times', 'Total', '% of Spent'], rows)].join('\n');
}

function weeksSection(spend: Entry[], month: string): string {
  return ['## Spending by week', ...weekBuckets(spend, month).map((b) => `- ${b.label}: ${formatFils(b.totalFils)}`)].join('\n');
}

function entriesSection(thisEntries: Entry[]): string {
  if (!thisEntries.length) return '## All entries\nNo entries this month.';
  const rows = [...thisEntries]
    .sort(byDateThenCreated)
    .map((e) => [e.date, cell(e.description), e.type, formatFils(e.amountFils)]);
  return ['## All entries', mdTable(['Date', 'Description', 'Type', 'Amount'], rows)].join('\n');
}

export function buildMonthReport(input: ReportInput): string {
  const thisEntries = entriesInMonth(input.entries, input.month);
  const lastEntries = entriesInMonth(input.entries, addMonths(input.month, -1));
  const spend = thisEntries.filter((e) => e.type === 'spend');
  const spentFils = monthTotals(thisEntries).spentFils;

  const sections = [
    `# Daftar: Month Report, ${monthLabel(input.month)}\nGenerated: ${shortDate(input.today)}. Currency: BHD.`,
    summarySection(input, thisEntries, lastEntries),
    fixedSection(input, thisEntries),
    whereSection(spend, spentFils),
    weeksSection(spend, input.month),
  ];
  if (input.includeEntries) sections.push(entriesSection(thisEntries));
  sections.push(`## Notes for analysis\n${REPORT_FOOTER}`);
  return sections.join('\n\n') + '\n';
}
