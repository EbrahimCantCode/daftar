import { describe, expect, it } from 'vitest';
import type { DataSnapshot } from './types';
import type { LegacySnapshot } from './migrate';
import { parseCsvRows, parseImport, toCsv } from './csv';

const snapshot: DataSnapshot = {
  settings: { paydayDay: 26, usualSalaryFils: 850_000, startingSavingsFils: 2_500_750, dailyGoalFils: 5_000, dailyGoalSince: '2026-11-01', theme: 'dark', schemaVersion: 3 },
  recurring: [
    { id: 'r1', name: 'Gym', amountFils: 25_000, timing: 'day', dayOfMonth: 31, type: 'fixed', active: true, nextCycle: '2026-12', createdAt: Date.UTC(2026, 0, 1) },
    { id: 'r2', name: 'Savings', amountFils: 200_000, timing: 'payday', dayOfMonth: 1, type: 'savings', active: false, nextCycle: '2026-08', createdAt: Date.UTC(2026, 0, 2) },
  ],
  entries: [
    {
      id: 'rec:r1:2026-11',
      date: '2026-10-31',
      amountFils: 25_000,
      description: 'Gym',
      type: 'fixed',
      recurringId: 'r1',
      recurringCycle: '2026-11',
      createdAt: Date.UTC(2026, 10, 1),
    },
    { id: 's1', date: '2026-10-26', amountFils: 850_000, description: 'Salary', type: 'income', salary: true, createdAt: Date.UTC(2026, 9, 26) },
    { id: 'b1', date: '2026-11-02', amountFils: 50_000, description: 'Bonus', type: 'income', createdAt: Date.UTC(2026, 10, 2) },
    { id: 'w1', date: '2026-11-03', amountFils: 120_000, description: 'Car repair', type: 'withdrawal', createdAt: Date.UTC(2026, 10, 3) },
    { id: 'e1', date: '2026-11-03', amountFils: 1_200, description: 'Karak, "large"', type: 'spend', createdAt: Date.UTC(2026, 10, 3, 8) },
    { id: 'e2', date: '2026-11-04', amountFils: 5, description: 'Tip', type: 'spend', createdAt: Date.UTC(2026, 10, 4) },
  ],
};

const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);

describe('CSV export/import', () => {
  it('round-trips every field exactly', () => {
    const preview = parseImport(toCsv(snapshot));
    expect(preview.errors).toEqual([]);
    expect(preview.hasSettings).toBe(true);
    expect(preview.legacy).toBe(false);
    expect(preview.data.settings).toEqual(snapshot.settings);
    expect(preview.data.recurring).toEqual(snapshot.recurring);
    expect(preview.data.entries).toEqual([...snapshot.entries].sort(byDate));
    expect(preview.firstDate).toBe('2026-10-26');
    expect(preview.lastDate).toBe('2026-11-04');
  });

  it('starts with a BOM and writes amounts as dinars', () => {
    const csv = toCsv(snapshot);
    expect(csv.startsWith('﻿kind,id,date,amount')).toBe(true);
    expect(csv).toContain(',0.005,Tip,');
  });

  it('round-trips with no usual salary set', () => {
    const preview = parseImport(toCsv({ ...snapshot, settings: { theme: 'system', paydayDay: 25, schemaVersion: 3 } }));
    expect(preview.data.settings).toEqual({ theme: 'system', paydayDay: 25, schemaVersion: 3 });
  });

  it('keeps the salary flag only on income', () => {
    const csv = 'kind,id,date,amount,description,type,salary\nentry,a,2026-11-01,1,Lunch,spend,true\nentry,b,2026-10-26,850,Salary,income,true\n';
    const { data, errors } = parseImport(csv);
    expect(errors).toEqual([]);
    expect(data.entries.map((e) => e.salary)).toEqual([undefined, true]);
  });

  it('migrates a backup written by the first version', () => {
    const v1: LegacySnapshot = {
      settings: { theme: 'dark', monthlyIncomeFils: 850_000 },
      recurring: [{ id: 'gym', name: 'Gym', amountFils: 25_000, dayOfMonth: 5, type: 'fixed', active: true, nextMonth: '2026-12', createdAt: 0 }],
      entries: [{ id: 'rec:gym:2026-11', date: '2026-11-05', amountFils: 25_000, description: 'Gym', type: 'fixed', recurringId: 'gym', createdAt: 0 }],
    };
    const preview = parseImport(toCsv(v1));
    expect(preview.errors).toEqual([]);
    expect(preview.legacy).toBe(true);
    expect(preview.data.settings).toEqual({ theme: 'dark', paydayDay: 26, schemaVersion: 2, usualSalaryFils: 850_000 });
    expect(preview.data.recurring).toEqual([
      { id: 'gym', name: 'Gym', amountFils: 25_000, timing: 'day', dayOfMonth: 5, type: 'fixed', active: true, nextCycle: '2026-12', createdAt: 0 },
    ]);
    expect(preview.data.entries).toEqual(v1.entries);
  });

  it('reads a version-1 file with its original columns', () => {
    const csv = [
      'kind,id,date,amount,description,type,recurring_id,created_at,name,day_of_month,active,next_month,income,theme',
      'setting,,,,,,,,,,,,850.000,system',
      'recurring,gym,,25.000,,fixed,,2026-01-01T00:00:00.000Z,Gym,5,true,2026-12,,',
      'entry,e1,2026-11-03,1.200,Karak,spend,,2026-11-03T08:00:00.000Z,,,,,,',
    ].join('\r\n');
    const preview = parseImport(csv);
    expect(preview.errors).toEqual([]);
    expect(preview.data.settings.usualSalaryFils).toBe(850_000);
    expect(preview.data.recurring[0]).toMatchObject({ timing: 'day', nextCycle: '2026-12' });
  });

  it('rejects a daily goal without a valid start date', () => {
    const csv = 'kind,id,date,amount,description,type,daily_goal,daily_goal_since\nsetting,,,,,,5,nope\n';
    expect(parseImport(csv).errors[0]).toMatchObject({ line: 2 });
  });

  it('reports bad rows by line and imports nothing from them', () => {
    const csv = [
      'kind,id,date,amount,description,type',
      'entry,a,2026-11-01,1.500,Lunch,spend',
      'entry,b,2026-02-30,1.500,Lunch,spend',
      'entry,c,2026-11-01,1.2345,Lunch,spend',
      'entry,d,2026-11-01,1,,spend',
      'entry,e,2026-11-01,1,Lunch,food',
      'entry,a,2026-11-01,1,Dup,spend',
      'wat,x,,,,',
    ].join('\n');
    const preview = parseImport(csv);
    expect(preview.errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(preview.data.entries.map((e) => e.id)).toEqual(['a']);
  });

  it('rejects files that are not Daftar exports', () => {
    expect(parseImport('date,amount\n2026-01-01,3').errors[0]?.message).toMatch(/missing columns/);
    expect(parseImport('').errors[0]?.message).toMatch(/empty/);
  });

  it('accepts columns in any order and skips blank lines', () => {
    const csv = 'type,description,amount,date,id,kind\r\n\r\nspend,Coffee,2,2026-11-02,z,entry\r\n';
    const preview = parseImport(csv, 7);
    expect(preview.errors).toEqual([]);
    expect(preview.data.entries).toEqual([
      { id: 'z', date: '2026-11-02', amountFils: 2000, description: 'Coffee', type: 'spend', createdAt: 7 },
    ]);
  });
});

describe('parseCsvRows', () => {
  it('handles quotes, escaped quotes and newlines inside cells', () => {
    expect(parseCsvRows('a,"b ""q"", c","x\ny"\n1,2,3').map((r) => r.cells)).toEqual([
      ['a', 'b "q", c', 'x\ny'],
      ['1', '2', '3'],
    ]);
  });

  it('tracks the starting line of each row', () => {
    expect(parseCsvRows('h\n"multi\nline"\nlast').map((r) => r.line)).toEqual([1, 2, 4]);
  });

  it('throws on an unclosed quote', () => {
    expect(() => parseCsvRows('a,"oops')).toThrow(/Unclosed/);
  });
});
