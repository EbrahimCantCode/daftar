import type { Entry, RecurringItem } from '../types';
import { addMonths, clampedDate, isValidMonth, monthsBetween } from './dates';

export interface RecurringPlan {
  entries: Entry[];
  /** Keys to add to the generated log. */
  generatedKeys: string[];
  /** New nextMonth cursor per item id. */
  cursors: Map<string, string>;
}

export const generatedKey = (itemId: string, month: string) => `${itemId}:${month}`;
export const recurringEntryId = (itemId: string, month: string) => `rec:${itemId}:${month}`;

/** Recovers the generated-log key from a generated entry id, if it is one. */
export function generatedKeyFromEntryId(entryId: string): string | null {
  const m = /^rec:(.+):(\d{4}-\d{2})$/.exec(entryId);
  return m ? generatedKey(m[1]!, m[2]!) : null;
}

/**
 * Works out which recurring entries are due, up to and including `currentMonth`.
 *
 * Idempotent by construction: a month is generated only if its key is absent from
 * `generated`, and the generated log is kept separately from entries, so editing or
 * deleting a generated entry never causes it to be created again.
 */
export function planRecurring(
  items: readonly RecurringItem[],
  generated: ReadonlySet<string>,
  currentMonth: string,
  now: number = Date.now(),
): RecurringPlan {
  const plan: RecurringPlan = { entries: [], generatedKeys: [], cursors: new Map() };
  for (const item of items) {
    if (!item.active || !isValidMonth(item.nextMonth) || item.nextMonth > currentMonth) continue;
    for (const month of monthsBetween(item.nextMonth, currentMonth)) {
      const key = generatedKey(item.id, month);
      if (generated.has(key)) continue;
      plan.entries.push({
        id: recurringEntryId(item.id, month),
        date: clampedDate(month, item.dayOfMonth),
        amountFils: item.amountFils,
        description: item.name,
        type: item.type,
        recurringId: item.id,
        createdAt: now,
      });
      plan.generatedKeys.push(key);
    }
    plan.cursors.set(item.id, addMonths(currentMonth, 1));
  }
  return plan;
}

/** Resuming never backfills the paused months. */
export function resumeItem(item: RecurringItem, currentMonth: string): RecurringItem {
  return { ...item, active: true, nextMonth: item.nextMonth > currentMonth ? item.nextMonth : currentMonth };
}
