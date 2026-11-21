import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Entry, LegacyRecurringItem, RecurringItem } from '../domain/types';
import {
  deleteEntry,
  eraseAll,
  importData,
  loadAll,
  migrate,
  needsMigration,
  openDaftarDB,
  putEntry,
  putRecurring,
  repairIfNeeded,
  runRecurring,
  saveSettings,
  type DaftarDB,
} from './db';

let db: DaftarDB;
let n = 0;

beforeEach(async () => {
  db = await openDaftarDB(`test-${++n}`);
});
afterEach(() => db.close());

const gym: RecurringItem = {
  id: 'gym',
  name: 'Gym',
  amountFils: 25_000,
  timing: 'day',
  dayOfMonth: 31,
  type: 'fixed',
  active: true,
  nextCycle: '2026-11',
  createdAt: 0,
};

async function freshV2() {
  expect(await needsMigration(db)).toBe(false);
}

describe('runRecurring', () => {
  it('posts once and never duplicates, even when run concurrently', async () => {
    await freshV2();
    await putRecurring(db, gym);
    await Promise.all([runRecurring(db, '2026-11-21'), runRecurring(db, '2026-11-21')]);
    expect(await runRecurring(db, '2026-11-21')).toBe(false);

    const { entries, recurring } = await loadAll(db);
    expect(entries.map((e) => e.date)).toEqual(['2026-10-31']); // day 31 in 26 Oct – 25 Nov
    expect(recurring[0]?.nextCycle).toBe('2026-12');
  });

  it('backfills missed cycles on the next open', async () => {
    await freshV2();
    await putRecurring(db, gym);
    await runRecurring(db, '2026-11-21');
    await runRecurring(db, '2027-02-10');
    const dates = (await loadAll(db)).entries.map((e) => e.date).sort();
    expect(dates).toEqual(['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31']);
  });

  it('keeps an edited posted entry and does not bring back a deleted one', async () => {
    await freshV2();
    await putRecurring(db, gym);
    await runRecurring(db, '2026-11-21');
    const [entry] = (await loadAll(db)).entries;
    await putEntry(db, { ...entry!, amountFils: 30_000 });
    await putRecurring(db, { ...gym, nextCycle: '2026-11' }); // a stale cursor
    expect(await runRecurring(db, '2026-11-21')).toBe(false);
    expect((await loadAll(db)).entries[0]?.amountFils).toBe(30_000);

    await deleteEntry(db, entry!.id);
    await runRecurring(db, '2026-11-21');
    expect((await loadAll(db)).entries).toEqual([]);
  });

  it('moves a payday item when the salary arrives late', async () => {
    await freshV2();
    await putRecurring(db, { ...gym, id: 'sav', name: 'Savings', timing: 'payday', type: 'savings', nextCycle: '2026-12' });
    await runRecurring(db, '2026-11-26');
    expect((await loadAll(db)).entries[0]?.date).toBe('2026-11-26');
    const salary: Entry = { id: 's', date: '2026-11-28', amountFils: 850_000, description: 'Salary', type: 'income', salary: true, createdAt: 1 };
    await putEntry(db, salary);
    expect(await runRecurring(db, '2026-11-28')).toBe(true);
    expect((await loadAll(db)).entries.find((e) => e.id === 'rec:sav:2026-12')?.date).toBe('2026-11-28');
  });
});

describe('migration', () => {
  it('sets up an empty database for cycles without asking', async () => {
    expect(await needsMigration(db)).toBe(false);
    expect((await loadAll(db)).settings).toMatchObject({ paydayDay: 26, schemaVersion: 3 });
  });

  it('moves version-1 data to cycles in one go, and only once', async () => {
    const legacyGym: LegacyRecurringItem = { id: 'gym', name: 'Gym', amountFils: 25_000, dayOfMonth: 5, type: 'fixed', active: true, nextMonth: '2026-12', createdAt: 0 };
    await db.put('recurring', legacyGym);
    await db.put('settings', { theme: 'system', monthlyIncomeFils: 850_000 }, 'settings');
    await db.put('generated', { key: 'gym:2026-11', at: 0 });
    await putEntry(db, { id: 'rec:gym:2026-11', date: '2026-11-05', amountFils: 25_000, description: 'Gym', type: 'fixed', recurringId: 'gym', createdAt: 0 });

    expect(await needsMigration(db)).toBe(true);
    // Nothing is posted while the old data is waiting to be migrated.
    expect(await runRecurring(db, '2026-11-21')).toBe(false);

    await migrate(db);
    await migrate(db);
    expect(await needsMigration(db)).toBe(false);
    const data = await loadAll(db);
    expect(data.settings).toMatchObject({ usualSalaryFils: 850_000, paydayDay: 26, schemaVersion: 2, salaryOfferPending: true });
    expect(data.recurring[0]).toMatchObject({ timing: 'day', nextCycle: '2026-12' });
    expect(await runRecurring(db, '2026-11-21')).toBe(false);
    expect(await runRecurring(db, '2026-11-26')).toBe(true); // December's gym
    expect((await loadAll(db)).entries.map((e) => e.id).sort()).toEqual(['rec:gym:2026-11', 'rec:gym:2026-12']);
  });
});

describe('importData', () => {
  it('rebuilds the generated log so a replace-import does not repost', async () => {
    await freshV2();
    await putRecurring(db, gym);
    await runRecurring(db, '2026-11-21');
    const snapshot = await loadAll(db);

    await eraseAll(db);
    expect((await loadAll(db)).entries).toEqual([]);
    expect(await needsMigration(db)).toBe(false);

    await importData(db, { ...snapshot, recurring: [{ ...gym, nextCycle: '2026-11' }] }, 'replace', true);
    expect(await runRecurring(db, '2026-11-21')).toBe(false);
    expect((await loadAll(db)).entries).toHaveLength(1);
  });

  it('merges by id and keeps settings unless asked', async () => {
    await freshV2();
    await saveSettings(db, { theme: 'system', paydayDay: 25, schemaVersion: 2 });
    await putEntry(db, { id: 'a', date: '2026-11-01', amountFils: 1000, description: 'Old', type: 'spend', createdAt: 1 });
    await putEntry(db, { id: 'b', date: '2026-11-02', amountFils: 2000, description: 'Keep', type: 'spend', createdAt: 2 });
    await importData(
      db,
      {
        entries: [{ id: 'a', date: '2026-11-01', amountFils: 1500, description: 'New', type: 'spend', createdAt: 1 }],
        recurring: [],
        settings: { theme: 'dark', paydayDay: 1, schemaVersion: 2 },
      },
      'merge',
      false,
    );
    const data = await loadAll(db);
    expect(data.entries.map((e) => `${e.id}:${e.description}`).sort()).toEqual(['a:New', 'b:Keep']);
    expect(data.settings).toEqual({ theme: 'system', paydayDay: 25, schemaVersion: 2 });
  });
});

describe('repair after migrating (schema 2 → 3)', () => {
  it('fixes the reported cycle: Gym added, YouTube moved, once', async () => {
    // Exactly the shape the phone had after the first migration.
    await db.put('settings', { theme: 'system', paydayDay: 26, schemaVersion: 2, usualSalaryFils: 150_000 }, 'settings');
    const item = (id: string, name: string, dayOfMonth: number, amountFils: number, nextCycle: string): RecurringItem => ({
      id,
      name,
      amountFils,
      timing: 'day',
      dayOfMonth,
      type: 'fixed',
      active: true,
      nextCycle,
      createdAt: Date.UTC(2026, 10, 12),
    });
    await putRecurring(db, item('claude', 'Claude', 5, 7_550, '2026-12'));
    await putRecurring(db, item('gym', 'Gym', 27, 20_000, '2027-01'));
    await putRecurring(db, item('yt', 'Youtube music', 29, 3_390, '2027-01'));
    const posted = (id: string, name: string, date: string, amountFils: number): Entry => ({
      id: `rec:${id}:${date.slice(0, 7)}`,
      date,
      amountFils,
      description: name,
      type: 'fixed',
      recurringId: id,
      createdAt: 0,
    });
    await putEntry(db, posted('claude', 'Claude', '2026-11-05', 7_550));
    await putEntry(db, posted('gym', 'Gym', '2026-11-27', 20_000));
    await putEntry(db, posted('yt', 'Youtube music', '2026-11-01', 3_390));
    await putEntry(db, { id: 's', date: '2026-10-26', amountFils: 150_000, description: 'Salary', type: 'income', salary: true, createdAt: 0 });
    for (const key of ['claude:2026-11', 'gym:2026-11', 'gym:2026-12', 'yt:2026-11', 'yt:2026-12']) await db.put('generated', { key, at: 0 });

    expect(await needsMigration(db)).toBe(false);
    expect(await repairIfNeeded(db, '2026-11-21')).toBe(true);
    expect(await repairIfNeeded(db, '2026-11-21')).toBe(false);
    await runRecurring(db, '2026-11-21');
    await runRecurring(db, '2026-11-21');

    const { entries, settings } = await loadAll(db);
    expect(settings.schemaVersion).toBe(3);
    const nov = entries.filter((e) => e.date >= '2026-10-26' && e.date <= '2026-11-25' && e.recurringId);
    expect(nov.map((e) => `${e.description} ${e.date}`).sort()).toEqual(['Claude 2026-11-05', 'Gym 2026-10-27', 'Youtube music 2026-10-29']);
    expect(entries.filter((e) => e.recurringId === 'gym').map((e) => e.date).sort()).toEqual(['2026-10-27', '2026-11-27']);
  });
});
