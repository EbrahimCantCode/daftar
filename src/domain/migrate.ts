import { clampedDate, isValidMonth } from './dates';
import { buildCycleContext, cycleFor } from './cycles';
import { generatedKey } from './recurring';
import {
  DEFAULT_PAYDAY,
  SCHEMA_VERSION,
  type DataSnapshot,
  type Entry,
  type LegacyRecurringItem,
  type LegacySettings,
  type RecurringItem,
  type Settings,
} from './types';

export interface LegacySnapshot {
  entries: Entry[];
  recurring: (LegacyRecurringItem | RecurringItem)[];
  settings: LegacySettings | Settings;
}

export function isMigrated(settings: LegacySettings | Settings | undefined): settings is Settings {
  return (settings as Settings | undefined)?.schemaVersion === SCHEMA_VERSION;
}

/**
 * Moves version-1 data (calendar months, a monthly-income setting) to pay cycles.
 *
 * - The monthly income becomes the usual salary; payday defaults to the 26th.
 * - Recurring items keep their day of the month; their cursor moves from the first
 *   un-posted calendar month to the cycle that month's posting would fall in.
 * - The generated log gains a per-cycle key for every entry already posted, so
 *   nothing is posted twice.
 * - Entries are untouched: cycles are always worked out from dates.
 *
 * Running it on already-migrated data returns it unchanged.
 */
export function migrateToV2(data: LegacySnapshot, generatedKeys: readonly string[]): { data: DataSnapshot; generatedKeys: string[] } {
  if (isMigrated(data.settings)) {
    return { data: data as DataSnapshot, generatedKeys: [...generatedKeys] };
  }
  const old = data.settings as LegacySettings;
  const settings: Settings = {
    theme: old.theme ?? 'system',
    paydayDay: DEFAULT_PAYDAY,
    schemaVersion: SCHEMA_VERSION,
  };
  if (old.monthlyIncomeFils !== undefined) settings.usualSalaryFils = old.monthlyIncomeFils;
  if (old.dailyGoalFils !== undefined) settings.dailyGoalFils = old.dailyGoalFils;
  if (old.dailyGoalSince !== undefined) settings.dailyGoalSince = old.dailyGoalSince;
  if (data.entries.length > 0) settings.salaryOfferPending = true;

  const ctx = buildCycleContext(data.entries, settings.paydayDay);
  const recurring: RecurringItem[] = data.recurring.map((r) => {
    if ('nextCycle' in r) return r;
    const { nextMonth, ...rest } = r;
    const nextCycle = isValidMonth(nextMonth) ? cycleFor(clampedDate(nextMonth, r.dayOfMonth), ctx).key : nextMonth;
    return { ...rest, timing: 'day', nextCycle };
  });

  const keys = new Set(generatedKeys);
  for (const e of data.entries) {
    if (e.recurringId && e.id.startsWith('rec:')) keys.add(generatedKey(e.recurringId, cycleFor(e.date, ctx).key));
  }

  return { data: { entries: data.entries, recurring, settings }, generatedKeys: [...keys].sort() };
}
