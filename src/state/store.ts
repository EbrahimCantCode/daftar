import { computed, signal } from '@preact/signals';
import { downloadBackup } from '../data/backup';
import { now } from '../data/clock';
import * as db from '../data/db';
import { newId } from '../data/id';
import { todayISO } from '../domain/dates';
import { buildCycleContext, cycleFor } from '../domain/cycles';
import { goalHeat, goalStreak, spendOnDay } from '../domain/goal';
import { resumeItem } from '../domain/recurring';
import { buildSuggestions } from '../domain/suggest';
import { cleanDescription } from '../domain/text';
import { DEFAULT_SETTINGS, type DataSnapshot, type Entry, type ImportMode, type RecurringItem, type Settings } from '../domain/types';

export const entries = signal<Entry[]>([]);
export const recurring = signal<RecurringItem[]>([]);
export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const ready = signal(false);
export const loadError = signal<string | null>(null);
/** True while version-1 data is waiting for the move to pay cycles. */
export const migrationNeeded = signal(false);
/** null until known; false when the browser declined (or does not support) persistent storage. */
export const persisted = signal<boolean | null>(null);

/** Today's date; updated at midnight and when the app returns to the foreground. */
export const today = signal(todayISO(now()));

let midnightTimer: ReturnType<typeof setTimeout> | undefined;
function refreshToday() {
  today.value = todayISO(now());
  clearTimeout(midnightTimer);
  const next = new Date();
  next.setHours(24, 0, 1, 0);
  midnightTimer = setTimeout(() => {
    refreshToday();
    void syncRecurring();
  }, next.getTime() - Date.now());
}

// ---- pay cycles -------------------------------------------------------------

export const cycleCtx = computed(() => buildCycleContext(entries.value, settings.value.paydayDay));
export const currentCycle = computed(() => cycleFor(today.value, cycleCtx.value));

// ---- daily goal ---------------------------------------------------------------

export const todaySpentFils = computed(() => spendOnDay(entries.value, today.value));
/** 0–1: how close today's spending is to the daily goal; 0 when no goal is set. */
export const goalHeatValue = computed(() => {
  const goal = settings.value.dailyGoalFils;
  return goal ? goalHeat(todaySpentFils.value, goal) : 0;
});
export const streak = computed(() => {
  const { dailyGoalFils: goal, dailyGoalSince: since } = settings.value;
  return goal && since ? goalStreak(entries.value, goal, since, today.value) : null;
});

export const suggestions = computed(() => buildSuggestions(entries.value.filter((e) => e.type !== 'income')));
export const recurringSorted = computed(() =>
  [...recurring.value].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      Number(b.timing === 'payday') - Number(a.timing === 'payday') ||
      a.dayOfMonth - b.dayOfMonth ||
      a.name.localeCompare(b.name),
  ),
);

let database: db.DaftarDB | null = null;
function getDb(): db.DaftarDB {
  if (!database) throw new Error('Database is not open yet');
  return database;
}

function apply(snapshot: DataSnapshot) {
  entries.value = snapshot.entries;
  recurring.value = snapshot.recurring;
  settings.value = snapshot.settings;
}

async function reload() {
  apply(await db.loadAll(getDb()));
}

export async function init(): Promise<void> {
  try {
    database = await db.openDaftarDB();
    if (await db.needsMigration(database)) {
      migrationNeeded.value = true;
    } else {
      await db.runRecurring(database, today.value);
      await reload();
    }
    ready.value = true;
  } catch (err) {
    console.error(err);
    loadError.value = 'Daftar could not open its storage on this device. Private browsing can block it.';
    return;
  }
  requestPersistence();
  refreshToday();
  // Catch a day or cycle rollover while the app stays open in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    refreshToday();
    void syncRecurring();
  });
}

async function requestPersistence() {
  if (!navigator.storage?.persist) {
    persisted.value = false;
    return;
  }
  try {
    persisted.value = (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    persisted.value = false;
  }
}

export async function syncRecurring(): Promise<void> {
  if (migrationNeeded.value || !database) return;
  if (await db.runRecurring(getDb(), today.value)) await reload();
}

// ---- migration ----------------------------------------------------------------

/** Downloads the data exactly as stored, before it's moved to pay cycles. */
export async function downloadPreMigrationBackup(): Promise<void> {
  downloadBackup(await db.loadForBackup(getDb()), today.value);
}

export async function runMigration(): Promise<void> {
  await db.migrate(getDb());
  migrationNeeded.value = false;
  await db.runRecurring(getDb(), today.value);
  await reload();
}

// ---- entries --------------------------------------------------------------

export interface EntryDraft {
  date: string;
  amountFils: number;
  description: string;
  type: Entry['type'];
  salary?: boolean;
}

/** Salaries move cycle boundaries, so recurring posting has to catch up after any change to one. */
const touchesCycles = (...list: (Entry | undefined)[]) => list.some((e) => e?.type === 'income' && e.salary);

export async function addEntry(draft: EntryDraft): Promise<Entry> {
  const entry: Entry = { ...draft, description: cleanDescription(draft.description), id: newId(), createdAt: Date.now() };
  if (!entry.salary) delete entry.salary;
  await db.putEntry(getDb(), entry);
  entries.value = [...entries.value, entry];
  if (touchesCycles(entry)) await syncRecurring();
  // The one-time "add this cycle's salary" offer is answered by logging any income.
  if (entry.type === 'income' && settings.value.salaryOfferPending) await updateSettings({ salaryOfferPending: undefined });
  return entry;
}

export async function updateEntry(entry: Entry): Promise<void> {
  const before = entries.value.find((e) => e.id === entry.id);
  const clean = { ...entry, description: cleanDescription(entry.description) };
  if (!clean.salary) delete clean.salary;
  await db.putEntry(getDb(), clean);
  entries.value = entries.value.map((e) => (e.id === clean.id ? clean : e));
  if (touchesCycles(before, clean)) await syncRecurring();
}

/** Deletes immediately; returns a function that puts the entry back. */
export async function removeEntry(entry: Entry): Promise<() => Promise<void>> {
  await db.deleteEntry(getDb(), entry.id);
  entries.value = entries.value.filter((e) => e.id !== entry.id);
  if (touchesCycles(entry)) await syncRecurring();
  return async () => {
    await db.putEntry(getDb(), entry);
    entries.value = [...entries.value.filter((e) => e.id !== entry.id), entry];
    if (touchesCycles(entry)) await syncRecurring();
  };
}

// ---- recurring ------------------------------------------------------------

export interface RecurringDraft {
  name: string;
  amountFils: number;
  timing: RecurringItem['timing'];
  dayOfMonth: number;
  type: RecurringItem['type'];
}

export async function addRecurring(draft: RecurringDraft): Promise<void> {
  const item: RecurringItem = {
    ...draft,
    name: cleanDescription(draft.name),
    id: newId(),
    active: true,
    nextCycle: currentCycle.value.key,
    createdAt: Date.now(),
  };
  await db.putRecurring(getDb(), item);
  recurring.value = [...recurring.value, item];
  await syncRecurring();
}

/** Changes future cycles only; entries already posted keep their values. */
export async function updateRecurring(item: RecurringItem): Promise<void> {
  const clean = { ...item, name: cleanDescription(item.name) };
  await db.putRecurring(getDb(), clean);
  recurring.value = recurring.value.map((r) => (r.id === clean.id ? clean : r));
}

export async function setRecurringActive(item: RecurringItem, active: boolean): Promise<void> {
  const next = active ? resumeItem(item, currentCycle.value.key) : { ...item, active: false };
  await db.putRecurring(getDb(), next);
  recurring.value = recurring.value.map((r) => (r.id === next.id ? next : r));
  if (active) await syncRecurring();
}

export async function removeRecurring(item: RecurringItem): Promise<void> {
  await db.deleteRecurring(getDb(), item.id);
  recurring.value = recurring.value.filter((r) => r.id !== item.id);
}

// ---- settings & data ------------------------------------------------------

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const next: Settings = { ...settings.value, ...patch };
  // A new goal starts its streak today; clearing the goal forgets the streak.
  if (next.dailyGoalFils === undefined) delete next.dailyGoalSince;
  else if (!next.dailyGoalSince) next.dailyGoalSince = today.value;
  for (const key of Object.keys(next) as (keyof Settings)[]) {
    if (next[key] === undefined) delete next[key];
  }
  const paydayChanged = next.paydayDay !== settings.value.paydayDay;
  await db.saveSettings(getDb(), next);
  settings.value = next;
  if (paydayChanged) await syncRecurring();
}

export function snapshot(): DataSnapshot {
  return { entries: entries.value, recurring: recurring.value, settings: settings.value };
}

export async function importSnapshot(data: DataSnapshot, mode: ImportMode, includeSettings: boolean): Promise<void> {
  await db.importData(getDb(), data, mode, includeSettings);
  await db.runRecurring(getDb(), today.value);
  await reload();
}

export async function eraseEverything(): Promise<void> {
  await db.eraseAll(getDb());
  await reload();
}
