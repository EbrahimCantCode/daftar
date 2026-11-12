import { computed, signal } from '@preact/signals';
import * as db from '../db/db';
import { now } from '../lib/clock';
import { currentMonth, todayISO } from '../lib/dates';
import { goalHeat, goalStreak, spendOnDay } from '../lib/goal';
import { newId } from '../lib/id';
import { resumeItem } from '../lib/recurring';
import { buildSuggestions } from '../lib/suggest';
import { cleanDescription } from '../lib/text';
import { DEFAULT_SETTINGS, type DataSnapshot, type Entry, type RecurringItem, type Settings } from '../types';

export const entries = signal<Entry[]>([]);
export const recurring = signal<RecurringItem[]>([]);
export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const ready = signal(false);
export const loadError = signal<string | null>(null);
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

export const suggestions = computed(() => buildSuggestions(entries.value));
export const recurringSorted = computed(() =>
  [...recurring.value].sort((a, b) => Number(b.active) - Number(a.active) || a.dayOfMonth - b.dayOfMonth || a.name.localeCompare(b.name)),
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
    await db.runRecurring(database, currentMonth(now()));
    await reload();
    ready.value = true;
  } catch (err) {
    console.error(err);
    loadError.value = 'Daftar could not open its storage on this device. Private browsing can block it.';
    return;
  }
  requestPersistence();
  refreshToday();
  // Catch a day or month rollover while the app stays open in the background.
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
  const added = await db.runRecurring(getDb(), currentMonth(now()));
  if (added.length) entries.value = [...entries.value, ...added];
}

// ---- entries --------------------------------------------------------------

export interface EntryDraft {
  date: string;
  amountFils: number;
  description: string;
  type: Entry['type'];
}

export async function addEntry(draft: EntryDraft): Promise<Entry> {
  const entry: Entry = { ...draft, description: cleanDescription(draft.description), id: newId(), createdAt: Date.now() };
  await db.putEntry(getDb(), entry);
  entries.value = [...entries.value, entry];
  return entry;
}

export async function updateEntry(entry: Entry): Promise<void> {
  const clean = { ...entry, description: cleanDescription(entry.description) };
  await db.putEntry(getDb(), clean);
  entries.value = entries.value.map((e) => (e.id === clean.id ? clean : e));
}

/** Deletes immediately; returns a function that puts the entry back. */
export async function removeEntry(entry: Entry): Promise<() => Promise<void>> {
  await db.deleteEntry(getDb(), entry.id);
  entries.value = entries.value.filter((e) => e.id !== entry.id);
  return async () => {
    await db.putEntry(getDb(), entry);
    entries.value = [...entries.value.filter((e) => e.id !== entry.id), entry];
  };
}

// ---- recurring ------------------------------------------------------------

export interface RecurringDraft {
  name: string;
  amountFils: number;
  dayOfMonth: number;
  type: RecurringItem['type'];
}

export async function addRecurring(draft: RecurringDraft): Promise<void> {
  const item: RecurringItem = {
    ...draft,
    name: cleanDescription(draft.name),
    id: newId(),
    active: true,
    nextMonth: currentMonth(now()),
    createdAt: Date.now(),
  };
  await db.putRecurring(getDb(), item);
  recurring.value = [...recurring.value, item];
  await syncRecurring();
}

/** Changes future months only; entries already generated keep their values. */
export async function updateRecurring(item: RecurringItem): Promise<void> {
  const clean = { ...item, name: cleanDescription(item.name) };
  await db.putRecurring(getDb(), clean);
  recurring.value = recurring.value.map((r) => (r.id === clean.id ? clean : r));
}

export async function setRecurringActive(item: RecurringItem, active: boolean): Promise<void> {
  const next = active ? resumeItem(item, currentMonth(now())) : { ...item, active: false };
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
  await db.saveSettings(getDb(), next);
  settings.value = next;
}

export function snapshot(): DataSnapshot {
  return { entries: entries.value, recurring: recurring.value, settings: settings.value };
}

export async function importSnapshot(data: DataSnapshot, mode: db.ImportMode, includeSettings: boolean): Promise<void> {
  await db.importData(getDb(), data, mode, includeSettings);
  await db.runRecurring(getDb(), currentMonth(now()));
  await reload();
}

export async function eraseEverything(): Promise<void> {
  await db.eraseAll(getDb());
  await reload();
}
