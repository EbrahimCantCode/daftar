import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RecurringItem } from '../types';
import { deleteEntry, eraseAll, importData, loadAll, openDaftarDB, putEntry, putRecurring, runRecurring, type DaftarDB } from './db';

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
  dayOfMonth: 31,
  type: 'fixed',
  active: true,
  nextMonth: '2026-11',
  createdAt: 0,
};

describe('runRecurring', () => {
  it('generates once and never duplicates, even when run concurrently', async () => {
    await putRecurring(db, gym);
    const [a, b] = await Promise.all([runRecurring(db, '2026-11'), runRecurring(db, '2026-11')]);
    expect(a.length + b.length).toBe(1);
    expect(await runRecurring(db, '2026-11')).toEqual([]);

    const { entries, recurring } = await loadAll(db);
    expect(entries.map((e) => e.date)).toEqual(['2026-11-30']);
    expect(recurring[0]?.nextMonth).toBe('2026-12');
  });

  it('backfills missed months on the next open', async () => {
    await putRecurring(db, gym);
    await runRecurring(db, '2026-11');
    const added = await runRecurring(db, '2027-02');
    expect(added.map((e) => e.date)).toEqual(['2026-12-31', '2027-01-31', '2027-02-28']);
  });

  it('keeps an edited generated entry and does not bring back a deleted one', async () => {
    await putRecurring(db, gym);
    const [entry] = await runRecurring(db, '2026-11');
    await putEntry(db, { ...entry!, amountFils: 30_000 });
    await putRecurring(db, { ...gym, nextMonth: '2026-11' }); // simulate a stale cursor
    expect(await runRecurring(db, '2026-11')).toEqual([]);
    expect((await loadAll(db)).entries[0]?.amountFils).toBe(30_000);

    await deleteEntry(db, entry!.id);
    expect(await runRecurring(db, '2026-11')).toEqual([]);
    expect((await loadAll(db)).entries).toEqual([]);
  });
});

describe('importData', () => {
  it('rebuilds the generated log so a replace-import does not regenerate', async () => {
    await putRecurring(db, gym);
    await runRecurring(db, '2026-11');
    const snapshot = await loadAll(db);

    await eraseAll(db);
    expect((await loadAll(db)).entries).toEqual([]);

    // Import the old data with a cursor that would otherwise re-create November.
    await importData(db, { ...snapshot, recurring: [{ ...gym, nextMonth: '2026-11' }] }, 'replace', true);
    expect(await runRecurring(db, '2026-11')).toEqual([]);
    expect((await loadAll(db)).entries).toHaveLength(1);
  });

  it('merges by id', async () => {
    await putEntry(db, { id: 'a', date: '2026-11-01', amountFils: 1000, description: 'Old', type: 'spend', createdAt: 1 });
    await putEntry(db, { id: 'b', date: '2026-11-02', amountFils: 2000, description: 'Keep', type: 'spend', createdAt: 2 });
    await importData(
      db,
      {
        entries: [{ id: 'a', date: '2026-11-01', amountFils: 1500, description: 'New', type: 'spend', createdAt: 1 }],
        recurring: [],
        settings: { theme: 'dark', monthlyIncomeFils: 5000 },
      },
      'merge',
      false,
    );
    const data = await loadAll(db);
    expect(data.entries.map((e) => `${e.id}:${e.description}`).sort()).toEqual(['a:New', 'b:Keep']);
    expect(data.settings).toEqual({ theme: 'system' });
  });
});
