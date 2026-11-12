import type { Entry, EntryType } from '../types';
import { monthOf } from './dates';
import { SpellingTally, descriptionKey } from './text';

export interface MonthTotals {
  fixedFils: number;
  spentFils: number;
  savedFils: number;
  totalOutFils: number;
}

export function entriesInMonth(entries: readonly Entry[], month: string): Entry[] {
  return entries.filter((e) => monthOf(e.date) === month);
}

export function monthTotals(entries: readonly Entry[]): MonthTotals {
  let fixedFils = 0;
  let spentFils = 0;
  let savedFils = 0;
  for (const e of entries) {
    if (e.type === 'fixed') fixedFils += e.amountFils;
    else if (e.type === 'savings') savedFils += e.amountFils;
    else spentFils += e.amountFils;
  }
  return { fixedFils, spentFils, savedFils, totalOutFils: fixedFils + spentFils + savedFils };
}

/** Income minus total out; undefined when no income is set. */
export function leftThisMonth(incomeFils: number | undefined, totals: MonthTotals): number | undefined {
  return incomeFils === undefined ? undefined : incomeFils - totals.totalOutFils;
}

export interface DayGroup {
  date: string;
  entries: Entry[];
  totalFils: number;
}

/** Newest day first; within a day, most recently created first. */
export function groupByDay(entries: readonly Entry[]): DayGroup[] {
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = byDate.get(e.date);
    if (list) list.push(e);
    else byDate.set(e.date, [e]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, list]) => {
      list.sort((a, b) => b.createdAt - a.createdAt);
      return { date, entries: list, totalFils: list.reduce((sum, e) => sum + e.amountFils, 0) };
    });
}

export interface BreakdownRow {
  key: string;
  label: string;
  totalFils: number;
  count: number;
  /** The group's entry type, or 'spend' when it mixes types. Used for the ink colour. */
  type: EntryType;
}

/** Top descriptions by total, grouped case-insensitively; the rest folded into "Other". */
export function breakdown(entries: readonly Entry[], top = 5): BreakdownRow[] {
  const groups = new Map<string, { row: BreakdownRow; tally: SpellingTally }>();
  for (const e of entries) {
    const key = descriptionKey(e.description);
    let g = groups.get(key);
    if (!g) {
      g = { row: { key, label: '', totalFils: 0, count: 0, type: e.type }, tally: new SpellingTally() };
      groups.set(key, g);
    }
    g.row.totalFils += e.amountFils;
    g.row.count++;
    if (g.row.type !== e.type) g.row.type = 'spend';
    g.tally.add(e.description, e.createdAt);
  }
  const rows = [...groups.values()]
    .map(({ row, tally }) => ({ ...row, label: tally.best() }))
    .sort((a, b) => b.totalFils - a.totalFils || a.label.localeCompare(b.label));

  if (rows.length <= top + 1) return rows;
  const rest = rows.slice(top);
  return [
    ...rows.slice(0, top),
    {
      key: '\u0000other',
      label: `Other (${rest.length})`,
      totalFils: rest.reduce((s, r) => s + r.totalFils, 0),
      count: rest.reduce((s, r) => s + r.count, 0),
      type: 'spend',
    },
  ];
}
