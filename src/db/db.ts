import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type DataSnapshot, type Entry, type RecurringItem, type Settings } from '../types';
import { generatedKeyFromEntryId, planRecurring } from '../lib/recurring';

interface DaftarSchema extends DBSchema {
  entries: { key: string; value: Entry; indexes: { date: string; recurringId: string } };
  recurring: { key: string; value: RecurringItem };
  /** Log of generated recurring entries, keyed "<itemId>:<YYYY-MM>". */
  generated: { key: string; value: { key: string; at: number } };
  settings: { key: string; value: Settings };
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

export async function loadAll(db: DaftarDB): Promise<DataSnapshot> {
  const tx = db.transaction(['entries', 'recurring', 'settings'], 'readonly');
  const [entries, recurring, settings] = await Promise.all([
    tx.objectStore('entries').getAll(),
    tx.objectStore('recurring').getAll(),
    tx.objectStore('settings').get(SETTINGS_KEY),
  ]);
  await tx.done;
  return { entries, recurring, settings: { ...DEFAULT_SETTINGS, ...settings } };
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
 * Adds any due recurring entries up to `currentMonth`, in one transaction across
 * recurring, generated and entries so concurrent tabs cannot create duplicates.
 * Returns the entries that were added.
 */
export async function runRecurring(db: DaftarDB, currentMonth: string, now = Date.now()): Promise<Entry[]> {
  const tx = db.transaction(['recurring', 'generated', 'entries'], 'readwrite');
  const recurringStore = tx.objectStore('recurring');
  const generatedStore = tx.objectStore('generated');
  const entryStore = tx.objectStore('entries');

  const [items, keys] = await Promise.all([recurringStore.getAll(), generatedStore.getAllKeys()]);
  const plan = planRecurring(items, new Set(keys), currentMonth, now);

  const added: Entry[] = [];
  for (const entry of plan.entries) {
    // An entry with this id can only exist if it came in through an import; keep it as is.
    if (!(await entryStore.getKey(entry.id))) {
      await entryStore.add(entry);
      added.push(entry);
    }
  }
  for (const key of plan.generatedKeys) await generatedStore.put({ key, at: now });
  for (const item of items) {
    const next = plan.cursors.get(item.id);
    if (next && next !== item.nextMonth) await recurringStore.put({ ...item, nextMonth: next });
  }
  await tx.done;
  return added;
}

export type ImportMode = 'merge' | 'replace';

/**
 * Writes imported data. "replace" wipes everything first; "merge" upserts by id.
 * The generated log is rebuilt from generated entry ids so imports never cause duplicates.
 */
export async function importData(db: DaftarDB, data: DataSnapshot, mode: ImportMode, includeSettings: boolean): Promise<void> {
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  if (mode === 'replace') await Promise.all(ALL_STORES.map((s) => tx.objectStore(s).clear()));
  const now = Date.now();
  for (const e of data.entries) {
    await tx.objectStore('entries').put(e);
    const key = generatedKeyFromEntryId(e.id);
    if (key) await tx.objectStore('generated').put({ key, at: now });
  }
  for (const r of data.recurring) await tx.objectStore('recurring').put(r);
  if (includeSettings) await tx.objectStore('settings').put(data.settings, SETTINGS_KEY);
  await tx.done;
}

export async function eraseAll(db: DaftarDB): Promise<void> {
  const tx = db.transaction([...ALL_STORES], 'readwrite');
  await Promise.all(ALL_STORES.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}
