import type { Entry, RecurringItem } from './types';
import { addMonths, clampedDate, isValidMonth, monthOf } from './dates';
import { cycleByKey, cycleFor, inCycle, type Cycle, type CycleContext } from './cycles';

export interface RecurringPlan {
  entries: Entry[];
  /** Keys to add to the generated log. */
  generatedKeys: string[];
  /** New nextCycle cursor per item id. */
  cursors: Map<string, string>;
  /** Already-posted entries whose cycle moved (a salary logged early or late): new dates. */
  moves: { id: string; date: string }[];
}

export const generatedKey = (itemId: string, cycleKey: string) => `${itemId}:${cycleKey}`;
export const recurringEntryId = (itemId: string, cycleKey: string) => `rec:${itemId}:${cycleKey}`;

function clampToCycle(date: string, cycle: Cycle): string {
  return date < cycle.start ? cycle.start : date > cycle.end ? cycle.end : date;
}

/**
 * The date an item is written on in a cycle: the cycle's first day for "on payday"
 * items; otherwise its day of the month within the cycle's expected range (payday to
 * the day before the next payday), clamped to short months and kept inside the cycle.
 */
export function postingDate(item: RecurringItem, cycle: Cycle, paydayDay: number): string {
  if (item.timing === 'payday') return cycle.start;
  const paydayMonth = monthOf(cycle.payday);
  const month = item.dayOfMonth >= paydayDay ? paydayMonth : addMonths(paydayMonth, 1);
  return clampToCycle(clampedDate(month, item.dayOfMonth), cycle);
}

/**
 * Works out which recurring entries are due, up to and including the cycle that
 * contains `today`.
 *
 * Idempotent by construction: a cycle is posted only if its key is absent from
 * `generated`, and the generated log is kept separately from entries, so editing or
 * deleting a posted entry never causes it to be created again.
 */
export function planRecurring(
  items: readonly RecurringItem[],
  generated: ReadonlySet<string>,
  entries: readonly Entry[],
  ctx: CycleContext,
  today: string,
  now: number = Date.now(),
): RecurringPlan {
  const plan: RecurringPlan = { entries: [], generatedKeys: [], cursors: new Map(), moves: [] };
  const current = cycleFor(today, ctx).key;
  const byId = new Map(items.map((i) => [i.id, i]));

  for (const item of items) {
    if (!item.active || !isValidMonth(item.nextCycle) || item.nextCycle > current) continue;
    for (let key = item.nextCycle; key <= current; key = addMonths(key, 1)) {
      const gk = generatedKey(item.id, key);
      if (generated.has(gk)) continue;
      const cycle = cycleByKey(key, ctx);
      plan.entries.push({
        id: recurringEntryId(item.id, key),
        date: postingDate(item, cycle, ctx.paydayDay),
        amountFils: item.amountFils,
        description: item.name,
        type: item.type,
        recurringId: item.id,
        recurringCycle: key,
        createdAt: now,
      });
      plan.generatedKeys.push(gk);
    }
    plan.cursors.set(item.id, addMonths(current, 1));
  }

  // Keep every posted entry inside the cycle it was posted for, so a cycle never
  // shows the same item twice after its start or end moves.
  for (const e of entries) {
    if (!e.recurringCycle) continue;
    const cycle = cycleByKey(e.recurringCycle, ctx);
    if (inCycle(e.date, cycle)) continue;
    const item = e.recurringId ? byId.get(e.recurringId) : undefined;
    plan.moves.push({ id: e.id, date: item?.timing === 'payday' ? cycle.start : clampToCycle(e.date, cycle) });
  }
  return plan;
}

/** Resuming never backfills the paused cycles. */
export function resumeItem(item: RecurringItem, currentCycle: string): RecurringItem {
  return { ...item, active: true, nextCycle: item.nextCycle > currentCycle ? item.nextCycle : currentCycle };
}
