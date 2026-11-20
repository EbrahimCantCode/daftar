import type { Entry, EntryType } from './types';
import { SpellingTally, descriptionKey } from './text';

export interface Totals {
  incomeFils: number;
  /** Taken out of savings to cover spending. */
  withdrawnFils: number;
  fixedFils: number;
  spentFils: number;
  savedFils: number;
  /** Fixed + spent + saved. */
  totalOutFils: number;
  /** Saved − withdrawn. Negative when more came out of savings than went in. */
  netSavedFils: number;
}

export function totalsOf(entries: readonly Entry[]): Totals {
  const t = { incomeFils: 0, withdrawnFils: 0, fixedFils: 0, spentFils: 0, savedFils: 0 };
  for (const e of entries) {
    switch (e.type) {
      case 'income':
        t.incomeFils += e.amountFils;
        break;
      case 'withdrawal':
        t.withdrawnFils += e.amountFils;
        break;
      case 'fixed':
        t.fixedFils += e.amountFils;
        break;
      case 'savings':
        t.savedFils += e.amountFils;
        break;
      case 'spend':
        t.spentFils += e.amountFils;
        break;
    }
  }
  return { ...t, totalOutFils: t.fixedFils + t.spentFils + t.savedFils, netSavedFils: t.savedFils - t.withdrawnFils };
}

/**
 * Money left: income + withdrawn from savings − total out. Undefined when no income
 * was logged, since there's nothing to subtract from.
 */
export function leftOf(totals: Totals): number | undefined {
  return totals.incomeFils > 0 ? totals.incomeFils + totals.withdrawnFils - totals.totalOutFils : undefined;
}

/** Entries that are money going out: fixed, spent and saved (not income or withdrawals). */
export function outgoing(entries: readonly Entry[]): Entry[] {
  return entries.filter((e) => e.type !== 'income' && e.type !== 'withdrawal');
}

/** Savings balance at the end of `date`: the starting balance + savings − withdrawals up to then. */
export function savingsBalance(entries: readonly Entry[], startingFils: number, date: string): number {
  let balance = startingFils;
  for (const e of entries) {
    if (e.date > date) continue;
    if (e.type === 'savings') balance += e.amountFils;
    else if (e.type === 'withdrawal') balance -= e.amountFils;
  }
  return balance;
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
      // The day total is money out; income on the day isn't added to it.
      return { date, entries: list, totalFils: outgoing(list).reduce((sum, e) => sum + e.amountFils, 0) };
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
