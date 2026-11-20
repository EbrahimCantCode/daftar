import type { Entry, RecurringItem } from './types';
import { addDays, addMonths, monthLabel, todayISO } from './dates';
import { buildCycleContext, cycleByKey, cycleFor, daysElapsed, entriesInCycle, type Cycle } from './cycles';
import { DASH, byDateThenCreated, cell, change, longDate, mdTable, percent, shortDate } from './markdown';
import { formatFils } from './money';
import { breakdown, leftOf, totalsOf, type Totals } from './totals';

// Builds the Month Report for one pay cycle: a Markdown statement meant to be pasted
// into an AI chat. Everything is computed from integer fils and formatted with formatFils.

export interface ReportInput {
  /** Cycle key, YYYY-MM (the month the cycle is named after). */
  cycleKey: string;
  /** All entries; the function picks this cycle and the one before. */
  entries: readonly Entry[];
  recurring: readonly RecurringItem[];
  paydayDay: number;
  /** YYYY-MM-DD, used for "Generated" and for how many days of the cycle have passed. */
  today: string;
  includeEntries: boolean;
}

export const REPORT_FOOTER = [
  "Amounts are in Bahraini Dinar. 'Fixed' = recurring monthly costs, 'Saved' = money moved to savings (not spending).",
  'Each month is a pay cycle: it runs from one salary to the day before the next, and is named after the month it mostly covers.',
].join(' ');

export interface WeekBucket {
  label: string;
  totalFils: number;
}

/** Spend totals for each 7-day block from the cycle's first day; the last block holds what remains. */
export function weekBuckets(spendEntries: readonly Entry[], cycle: Cycle): WeekBucket[] {
  const buckets: (WeekBucket & { from: string; to: string })[] = [];
  for (let from = cycle.start, n = 1; from <= cycle.end; from = addDays(from, 7), n++) {
    const sevenOn = addDays(from, 6);
    const to = sevenOn < cycle.end ? sevenOn : cycle.end;
    const full = to === sevenOn;
    const range = from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;
    buckets.push({ from, to, label: full ? `Week ${n} (${range})` : `Remaining days (${range})`, totalFils: 0 });
  }
  for (const e of spendEntries) {
    const bucket = buckets.find((b) => e.date >= b.from && e.date <= b.to);
    if (bucket) bucket.totalFils += e.amountFils;
  }
  return buckets.map(({ label, totalFils }) => ({ label, totalFils }));
}

function summarySection(input: ReportInput, cycle: Cycle, thisEntries: Entry[], lastEntries: Entry[]): string {
  const now = totalsOf(thisEntries);
  const prev = totalsOf(lastEntries);
  const hasLast = lastEntries.length > 0;
  const showIncome = now.incomeFils > 0 || (hasLast && prev.incomeFils > 0);

  const fmt = (v: number | undefined) => (v === undefined ? DASH : formatFils(v));
  const row = (label: string, cur: number | undefined, last: number | undefined) => [
    label,
    fmt(cur),
    hasLast ? fmt(last) : DASH,
    hasLast && cur !== undefined && last !== undefined ? change(cur, last) : DASH,
  ];
  const pick = (k: keyof Totals) => row(labelOf[k], now[k], prev[k]);

  const rows: string[][] = [];
  if (showIncome) rows.push(pick('incomeFils'));
  rows.push(pick('fixedFils'), pick('spentFils'), pick('savedFils'), pick('totalOutFils'));
  if (showIncome) rows.push(row('Left', leftOf(now), leftOf(prev)));

  const spend = thisEntries.filter((e) => e.type === 'spend');
  const days = daysElapsed(cycle, input.today);
  const average = days > 0 ? `average ${formatFils(Math.round(now.spentFils / days))} per day` : 'no days have passed yet';

  let biggest = DASH;
  const top = spend.reduce<Entry | undefined>((best, e) => (!best || e.amountFils > best.amountFils ? e : best), undefined);
  if (top) biggest = `${top.description}, ${formatFils(top.amountFils)}, ${top.date}`;

  const lastCounted = addDays(cycle.start, days - 1);
  const spendDays = new Set(spend.filter((e) => e.date <= lastCounted).map((e) => e.date));
  const noSpendDays = days > 0 ? String(days - spendDays.size) : DASH;

  return [
    '## Summary',
    mdTable(['', 'This cycle', 'Last cycle', 'Change'], rows),
    '',
    `- Number of spending entries: ${spend.length} (${average})`,
    `- Biggest single expense: ${biggest}`,
    `- Days with no spending: ${noSpendDays}`,
  ].join('\n');
}

const labelOf: Record<keyof Totals, string> = {
  incomeFils: 'Income',
  fixedFils: 'Fixed',
  spentFils: 'Spent',
  savedFils: 'Saved',
  totalOutFils: 'Total out',
};

function fixedSection(input: ReportInput, cycle: Cycle, thisEntries: Entry[]): string {
  const items = new Map(input.recurring.map((r) => [r.id, r]));
  const lines: string[] = [];
  const planned = thisEntries.filter((e) => e.type === 'fixed' || e.type === 'savings').sort(byDateThenCreated);
  for (const e of planned) {
    let note = '';
    const item = e.recurringId ? items.get(e.recurringId) : undefined;
    if (!e.recurringId) note = ' (one-off)';
    else if (item && item.amountFils !== e.amountFils) note = ` (usually ${formatFils(item.amountFils)})`;
    lines.push(`- ${e.description} (${e.type}, ${e.date}): ${formatFils(e.amountFils)}${note}`);
  }

  // Active items that should have been written this cycle but weren't (e.g. deleted).
  const recorded = new Set(planned.map((e) => e.recurringId).filter(Boolean));
  const ctx = buildCycleContext(input.entries, input.paydayDay);
  const current = cycleFor(input.today, ctx).key;
  for (const item of input.recurring) {
    const started = cycleFor(todayISO(new Date(item.createdAt)), ctx).key;
    if (item.active && !recorded.has(item.id) && cycle.key >= started && cycle.key <= current) {
      lines.push(`- ${item.name} (${item.type}): not recorded this cycle (usually ${formatFils(item.amountFils)})`);
    }
  }

  return ['## Fixed & savings', lines.length ? lines.join('\n') : '- None this cycle.'].join('\n');
}

function whereSection(spend: Entry[], spentFils: number): string {
  if (spentFils === 0) return '## Where the money went\nNo spending this cycle.';
  const rows = breakdown(spend, 10).map((r) => [cell(r.label), String(r.count), formatFils(r.totalFils), percent(r.totalFils, spentFils)]);
  return ['## Where the money went', mdTable(['Description', 'Times', 'Total', '% of Spent'], rows)].join('\n');
}

function weeksSection(spend: Entry[], cycle: Cycle): string {
  return ['## Spending by week', ...weekBuckets(spend, cycle).map((b) => `- ${b.label}: ${formatFils(b.totalFils)}`)].join('\n');
}

function entriesSection(thisEntries: Entry[]): string {
  if (!thisEntries.length) return '## All entries\nNo entries this cycle.';
  const rows = [...thisEntries].sort(byDateThenCreated).map((e) => [e.date, cell(e.description), e.type, formatFils(e.amountFils)]);
  return ['## All entries', mdTable(['Date', 'Description', 'Type', 'Amount'], rows)].join('\n');
}

export function buildMonthReport(input: ReportInput): string {
  const ctx = buildCycleContext(input.entries, input.paydayDay);
  const cycle = cycleByKey(input.cycleKey, ctx);
  const thisEntries = entriesInCycle(input.entries, cycle);
  const lastEntries = entriesInCycle(input.entries, cycleByKey(addMonths(input.cycleKey, -1), ctx));
  const spend = thisEntries.filter((e) => e.type === 'spend');
  const spentFils = totalsOf(thisEntries).spentFils;

  const sections = [
    `# Daftar: Month Report, ${monthLabel(input.cycleKey)}\n` +
      `Generated: ${longDate(input.today)}. Cycle: ${longDate(cycle.start)} – ${longDate(cycle.end)}. Currency: BHD.`,
    summarySection(input, cycle, thisEntries, lastEntries),
    fixedSection(input, cycle, thisEntries),
    whereSection(spend, spentFils),
    weeksSection(spend, cycle),
  ];
  if (input.includeEntries) sections.push(entriesSection(thisEntries));
  sections.push(`## Notes for analysis\n${REPORT_FOOTER}`);
  return sections.join('\n\n') + '\n';
}
