import { buildCycleContext, cycleByKey, cycleFor, type CycleContext } from './cycles';
import { generatedKey, postingDate, recurringEntryId } from './recurring';
import type { DataSnapshot, Entry, RecurringItem } from './types';

/** The cycle a posted entry belongs to: the one it was posted for, or the one its date falls in. */
function cycleOfPosting(e: Entry, ctx: CycleContext): string {
  return e.recurringCycle ?? cycleFor(e.date, ctx).key;
}

const isPosting = (e: Entry, itemId: string) => e.recurringId === itemId && e.id.startsWith('rec:');

export interface RepairResult {
  /** Entries whose date or cycle changed (saved under their new id). */
  changed: Entry[];
  /** Old ids of entries that were saved under a new id. */
  removedIds: string[];
  /** The full generated log after the repair. */
  generatedKeys: string[];
  recurring: RecurringItem[];
}

/**
 * One-time repair (schema 2 → 3) for data moved from calendar months.
 *
 * The first migration kept month-based "already posted" records and entries dated by
 * calendar month. For an item on a day near payday (Gym on the 27th) that left the
 * current cycle without its entry, and an item whose day was changed (YouTube, 1st →
 * 29th) kept its old date. For the current cycle and later only, this:
 *  - re-dates entries posted by the old version to the item's day in their cycle, and
 *    re-keys them by cycle,
 *  - rebuilds the item's "already posted" records from the entries that exist,
 *  - moves the item's cursor back to the current cycle,
 * so the planner then writes whatever is missing, once. Past cycles are left as they are.
 */
export function repairPostings(data: DataSnapshot, generatedKeys: readonly string[], today: string): RepairResult {
  const ctx = buildCycleContext(data.entries, data.settings.paydayDay);
  const current = cycleFor(today, ctx).key;
  const changed: Entry[] = [];
  const removedIds: string[] = [];
  const keys = new Set(generatedKeys);

  const recurring = data.recurring.map((item) => {
    // Forget this item's records for the current cycle on; they're rebuilt below from real entries.
    for (const k of [...keys]) {
      const [id, cycle] = [k.slice(0, k.lastIndexOf(':')), k.slice(k.lastIndexOf(':') + 1)];
      if (id === item.id && cycle >= current) keys.delete(k);
    }
    for (const e of data.entries) {
      if (!isPosting(e, item.id)) continue;
      const cycleKey = cycleOfPosting(e, ctx);
      if (cycleKey < current) continue;
      keys.add(generatedKey(item.id, cycleKey));
      if (e.recurringCycle) continue; // posted by the cycle version: already right
      const target = postingDate(item, cycleByKey(cycleKey, ctx), ctx.paydayDay);
      // Old ids carry the calendar month ("rec:gym:2026-11" for 27 Nov); give the entry its
      // cycle's id so it can't collide with the id the cycle it left will need.
      const id = recurringEntryId(item.id, cycleKey);
      if (id !== e.id) removedIds.push(e.id);
      changed.push({ ...e, id, date: target, recurringCycle: cycleKey });
    }
    return item.active && item.nextCycle > current ? { ...item, nextCycle: current } : item;
  });

  return { changed, removedIds, generatedKeys: [...keys].sort(), recurring };
}

/**
 * After editing a recurring item, the entries it already posted for the current and
 * later cycles follow the new day, amount, name and type, unless they were edited by
 * hand (they no longer match what the old item would have written).
 */
export function realignPostings(before: RecurringItem, after: RecurringItem, entries: readonly Entry[], ctx: CycleContext, today: string): Entry[] {
  const current = cycleFor(today, ctx).key;
  const out: Entry[] = [];
  for (const e of entries) {
    if (!isPosting(e, before.id)) continue;
    const cycleKey = cycleOfPosting(e, ctx);
    if (cycleKey < current) continue;
    const cycle = cycleByKey(cycleKey, ctx);
    const untouched =
      e.date === postingDate(before, cycle, ctx.paydayDay) &&
      e.amountFils === before.amountFils &&
      e.description === before.name &&
      e.type === before.type;
    if (!untouched) continue;
    const next: Entry = {
      ...e,
      date: postingDate(after, cycle, ctx.paydayDay),
      amountFils: after.amountFils,
      description: after.name,
      type: after.type,
      recurringCycle: cycleKey,
    };
    if (next.date !== e.date || next.amountFils !== e.amountFils || next.description !== e.description || next.type !== e.type) out.push(next);
  }
  return out;
}
