import type { Entry, EntryType } from './types';
import { breakdown, type BreakdownRow } from './totals';
import { descriptionKey } from './text';

// Groups a cycle's money out into slices for the "Where it went" chart.

export type SliceMode = 'spend' | 'all';

export interface Slice {
  key: string;
  label: string;
  totalFils: number;
  count: number;
  /** Ink for slices that stand for a whole type (Fixed, Saved); undefined for descriptions. */
  type?: EntryType;
  entries: Entry[];
}

export const OTHER_KEY = '\u0000other';
export const FIXED_KEY = '\u0000fixed';
export const SAVED_KEY = '\u0000saved';

/** The entries the chart is about: spend only, or everything out (spend + fixed + saved). */
export function chartEntries(entries: readonly Entry[], mode: SliceMode): Entry[] {
  return entries.filter((e) => e.type === 'spend' || (mode === 'all' && (e.type === 'fixed' || e.type === 'savings')));
}

/**
 * Up to `top` slices plus "Other", biggest first. Spending is grouped by description
 * (trimmed, case-insensitive). In "everything out" mode all fixed entries form one
 * Fixed slice and all savings one Saved slice.
 */
export function slicesOf(entries: readonly Entry[], mode: SliceMode, top = 7): Slice[] {
  const spend = entries.filter((e) => e.type === 'spend');
  const byKey = new Map<string, Entry[]>();
  for (const e of spend) {
    const k = descriptionKey(e.description);
    byKey.set(k, [...(byKey.get(k) ?? []), e]);
  }
  const all: Slice[] = breakdown(spend, Number.POSITIVE_INFINITY).map((r: BreakdownRow) => ({
    key: r.key,
    label: r.label,
    totalFils: r.totalFils,
    count: r.count,
    entries: byKey.get(r.key) ?? [],
  }));
  if (mode === 'all') {
    for (const [key, type, label] of [
      [FIXED_KEY, 'fixed', 'Fixed'],
      [SAVED_KEY, 'savings', 'Saved'],
    ] as const) {
      const list = entries.filter((e) => e.type === type);
      if (list.length) all.push({ key, label, type, totalFils: list.reduce((s, e) => s + e.amountFils, 0), count: list.length, entries: list });
    }
  }
  all.sort((a, b) => b.totalFils - a.totalFils || a.label.localeCompare(b.label));
  if (all.length <= top + 1) return all;
  const rest = all.slice(top);
  return [
    ...all.slice(0, top),
    {
      key: OTHER_KEY,
      label: `Other (${rest.length})`,
      totalFils: rest.reduce((s, r) => s + r.totalFils, 0),
      count: rest.reduce((s, r) => s + r.count, 0),
      entries: rest.flatMap((r) => r.entries),
    },
  ];
}

export interface Arc {
  start: number;
  end: number;
}

/** Angles (radians, clockwise from 12 o'clock) for each slice; tiny slices still get a sliver. */
export function sliceAngles(slices: readonly Slice[], minAngle = 0.02): Arc[] {
  const total = slices.reduce((s, x) => s + x.totalFils, 0);
  if (total <= 0) return slices.map(() => ({ start: 0, end: 0 }));
  const raw = slices.map((s) => Math.max((s.totalFils / total) * Math.PI * 2, minAngle));
  const scale = (Math.PI * 2) / raw.reduce((a, b) => a + b, 0);
  let at = -Math.PI / 2;
  return raw.map((r) => {
    const arc = { start: at, end: at + r * scale };
    at = arc.end;
    return arc;
  });
}
