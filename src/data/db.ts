import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { buildCycleContext, cycleFor } from '../domain/cycles';
import { isMigrated, migrateToV2, type LegacySnapshot } from '../domain/migrate';
import { generatedKey, planRecurring } from '../domain/recurring';
import { repairPostings } from '../domain/repair';
import {
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  type DataSnapshot,
  type Entry,
  type ImportMode,
  type LegacyRecurringItem,
  type LegacySettings,
  type RecurringItem,
  type Settings,
} from '../domain/types';

interface DaftarSchema extends DBSchema {
  entries: { key: string; value: Entry; indexes: { date: string; recurringId: string } };
  /** Holds RecurringItem, or LegacyRecurringItem until the v2 migration runs. */
  recurring: { key: string; value: RecurringItem | LegacyRecurringItem };
  /** Log of posted recurring entries, keyed "<itemId>:<cycle key>". */
  generated: { key: string; value: { key: string; at: number } };
  settings: { key: string; value: Settings | LegacySettings };
}

export type DaftarDB = IDBPDatabase<DaftarSchema>;

const SETTINGS_KEY = 'settings';
const ALL_STORES = ['entries', 'recurring', 'generated', 'settings'] as const;

export function openDaftarDB(name = 'daftar'): Promise<DaftarDB> {
  return openDB<DaftarSchema>(name, 1, {
    upgrade(db) {
      const entries = db.createObjectStore('entries', { keyPath: 'id' });
      entries.createIndex('date', 'date');
      entries.createIndex('recurringId', 'recurringId');
      db.createObjectStore('recurring', { keyPath: 'id' });
      db.createObjectStore('generated', { keyPath: 'key' });
      db.createObjectStore('settings');
    },
  });
}

async function loadRaw(db: DaftarDB): Promise<LegacySnapshot & { hasSettings: boolean }> {
  const tx = db.transaction(['entries', 'recurring', 'settings'], 'readonly');
  const [entries, recurring, settings] = await Promise.all([
    tx.objectStore('entries').getAll(),
    tx.objectStore('recurring').getAll(),
    tx.objectStore('settings').get(SETTINGS_KEY),
  ]);
  await tx.done;
  return { entries, recurring, settings: settings ?? { theme: 'system' }, hasSettings: !!settings };
}

/**
 * True when the stored data was written by version 1 and has to be moved to pay
 * cycles. A brand-new, empty database is set up for v2 straight away instead.
 */
export async function needsMigration(db: DaftarDB): Promise<boolean> {
  const raw = await loadRaw(db);
  if (isMigrated(raw.settings)) return false;
  if (!raw.hasSettings && raw.entries.length === 0 && raw.recurring.length === 0) {
    await db.put('settings', DEFAULT_SETTINGS, SETTINGS_KEY);
    return false;
  }
  return true;
}

/** Runs the v1 → v2 migration in one transaction. Safe to run twice. */
export async function migrate(db: DaftarDB): Promise<void> {
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  const [entries, recurring, settings, keys] = await Promise.all([
    tx.objectStore('entries').getAll(),
    tx.objectStore('recurring').getAll(),
    tx.objectStore('settings').get(SETTINGS_KEY),
    tx.objectStore('generated').getAllKeys(),
  ]);
  const result = migrateToV2({ entries, recurring, settings: settings ?? { theme: 'system' } }, keys);
  for (const r of result.data.recurring) await tx.objectStore('recurring').put(r);
  await tx.objectStore('settings').put(result.data.settings, SETTINGS_KEY);
  const now = Date.now();
  for (const key of result.generatedKeys) await tx.objectStore('generated').put({ key, at: now });
  await tx.done;
}

/** Runs the schema 2 → 3 repair (see repairPostings) once, in one transaction. Returns true if it ran. */
export async function repairIfNeeded(db: DaftarDB, today: string): Promise<boolean> {
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  const [entries, recurring, settings, keys] = await Promise.all([
    tx.objectStore('entries').getAll(),
    tx.objectStore('recurring').getAll(),
    tx.objectStore('settings').get(SETTINGS_KEY),
    tx.objectStore('generated').getAllKeys(),
  ]);
  if (!isMigrated(settings) || (settings.schemaVersion ?? 0) >= SCHEMA_VERSION) {
    await tx.done;
    return false;
  }
  const result = repairPostings({ entries, recurring: recurring as RecurringItem[], settings }, keys, today);
  for (const id of result.removedIds) await tx.objectStore('entries').delete(id);
  for (const e of result.changed) await tx.objectStore('entries').put(e);
  await tx.objectStore('generated').clear();
  const now = Date.now();
  for (const key of result.generatedKeys) await tx.objectStore('generated').put({ key, at: now });
  for (const r of result.recurring) await tx.objectStore('recurring').put(r);
  await tx.objectStore('settings').put({ ...settings, schemaVersion: SCHEMA_VERSION }, SETTINGS_KEY);
  await tx.done;
  return true;
}

/** Saves several entries in one transaction. */
export async function putEntries(db: DaftarDB, list: Entry[]): Promise<void> {
  const tx = db.transaction('entries', 'readwrite');
  for (const e of list) await tx.store.put(e);
  await tx.done;
}

/** Loads migrated data. */
export async function loadAll(db: DaftarDB): Promise<DataSnapshot> {
  const raw = await loadRaw(db);
  return {
    entries: raw.entries,
    recurring: raw.recurring as RecurringItem[],
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings as Settings) },
  };
}

/** The raw stored data, for a backup before migrating. */
export async function loadForBackup(db: DaftarDB): Promise<LegacySnapshot> {
  const { entries, recurring, settings } = await loadRaw(db);
  return { entries, recurring, settings };
}

export async function putEntry(db: DaftarDB, entry: Entry): Promise<void> {
  await db.put('entries', entry);
}

export async function deleteEntry(db: DaftarDB, id: string): Promise<void> {
  await db.delete('entries', id);
}

export async function putRecurring(db: DaftarDB, item: RecurringItem): Promise<void> {
  await db.put('recurring', item);
}

/** Deletes the item only; entries it already generated stay in the ledger. */
export async function deleteRecurring(db: DaftarDB, id: string): Promise<void> {
  await db.delete('recurring', id);
}

export async function saveSettings(db: DaftarDB, settings: Settings): Promise<void> {
  await db.put('settings', settings, SETTINGS_KEY);
}

/**
 * Posts any due recurring entries up to the cycle containing `today`, and keeps
 * already-posted entries inside their cycle, in one transaction across recurring,
 * generated, entries and settings so concurrent tabs cannot create duplicates.
 * Returns true when anything changed.
 */
export async function runRecurring(db: DaftarDB, today: string, now = Date.now()): Promise<boolean> {
  const tx = db.transaction(['recurring', 'generated', 'entries', 'settings'], 'readwrite');
  const recurringStore = tx.objectStore('recurring');
  const generatedStore = tx.objectStore('generated');
  const entryStore = tx.objectStore('entries');

  const [items, keys, entries, settings] = await Promise.all([
    recurringStore.getAll(),
    generatedStore.getAllKeys(),
    entryStore.getAll(),
    tx.objectStore('settings').get(SETTINGS_KEY),
  ]);
  if (!isMigrated(settings)) {
    await tx.done;
    return false;
  }
  const ctx = buildCycleContext(entries, settings.paydayDay);
  const plan = planRecurring(items as RecurringItem[], new Set(keys), entries, ctx, today, now);

  let changed = false;
  for (const entry of plan.entries) {
    // An entry with this id can only exist if it came in through an import; keep it as is.
    if (!(await entryStore.getKey(entry.id))) {
      await entryStore.add(entry);
      changed = true;
    }
  }
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const move of plan.moves) {
    const e = byId.get(move.id);
    if (e) {
      await entryStore.put({ ...e, date: move.date });
      changed = true;
    }
  }
  for (const key of plan.generatedKeys) await generatedStore.put({ key, at: now });
  for (const item of items as RecurringItem[]) {
    const next = plan.cursors.get(item.id);
    if (next && next !== item.nextCycle) await recurringStore.put({ ...item, nextCycle: next });
  }
  await tx.done;
  return changed;
}

/**
 * Writes imported (already migrated) data. "replace" wipes everything first; "merge"
 * upserts by id. The generated log is rebuilt from posted entries so imports never
 * cause duplicates.
 */
export async function importData(db: DaftarDB, data: DataSnapshot, mode: ImportMode, includeSettings: boolean): Promise<void> {
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  const existing = (await tx.objectStore('settings').get(SETTINGS_KEY)) as Settings | undefined;
  if (mode === 'replace') await Promise.all(ALL_STORES.map((s) => tx.objectStore(s).clear()));
  const paydayDay = includeSettings ? data.settings.paydayDay : (existing?.paydayDay ?? DEFAULT_SETTINGS.paydayDay);
  const ctx = buildCycleContext(data.entries, paydayDay);
  const now = Date.now();
  for (const e of data.entries) {
    await tx.objectStore('entries').put(e);
    if (e.recurringId && e.id.startsWith('rec:')) {
      const key = generatedKey(e.recurringId, e.recurringCycle ?? cycleFor(e.date, ctx).key);
      await tx.objectStore('generated').put({ key, at: now });
    }
  }
  for (const r of data.recurring) await tx.objectStore('recurring').put(r);
  if (includeSettings) await tx.objectStore('settings').put(data.settings, SETTINGS_KEY);
  else if (mode === 'replace' && existing) await tx.objectStore('settings').put(existing, SETTINGS_KEY);
  await tx.done;
}

export async function eraseAll(db: DaftarDB): Promise<void> {
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  await Promise.all(ALL_STORES.map((s) => tx.objectStore(s).clear()));
  await tx.objectStore('settings').put(DEFAULT_SETTINGS, SETTINGS_KEY);
  await tx.done;
}
