import { describe, expect, it } from 'vitest';
import type { DataSnapshot } from '../types';
import { parseCsvRows, parseImport, toCsv } from './csv';

const snapshot: DataSnapshot = {
  settings: { monthlyIncomeFils: 850_000, theme: 'dark' },
  recurring: [
    { id: 'r1', name: 'Gym', amountFils: 25_000, dayOfMonth: 31, type: 'fixed', active: true, nextMonth: '2026-12', createdAt: Date.UTC(2026, 0, 1) },
    { id: 'r2', name: 'Savings', amountFils: 200_000, dayOfMonth: 1, type: 'savings', active: false, nextMonth: '2026-08', createdAt: Date.UTC(2026, 0, 2) },
  ],
  entries: [
    { id: 'rec:r1:2026-11', date: '2026-11-30', amountFils: 25_000, description: 'Gym', type: 'fixed', recurringId: 'r1', createdAt: Date.UTC(2026, 10, 1) },
    { id: 'e1', date: '2026-11-03', amountFils: 1_200, description: 'Karak, "large"', type: 'spend', createdAt: Date.UTC(2026, 10, 3, 8) },
    { id: 'e2', date: '2026-11-04', amountFils: 5, description: 'Tip', type: 'spend', createdAt: Date.UTC(2026, 10, 4) },
  ],
};

describe('CSV export/import', () => {
  it('round-trips every field exactly', () => {
    const preview = parseImport(toCsv(snapshot));
    expect(preview.errors).toEqual([]);
    expect(preview.hasSettings).toBe(true);
    expect(preview.data.settings).toEqual(snapshot.settings);
    expect(preview.data.recurring).toEqual(snapshot.recurring);
    expect(preview.data.entries).toEqual([...snapshot.entries].sort((a, b) => a.date.localeCompare(b.date)));
    expect(preview.firstDate).toBe('2026-11-03');
    expect(preview.lastDate).toBe('2026-11-30');
  });

  it('starts with a BOM and writes amounts as dinars', () => {
    const csv = toCsv(snapshot);
    expect(csv.startsWith('﻿kind,id,date,amount')).toBe(true);
    expect(csv).toContain(',0.005,Tip,');
  });

  it('round-trips with no income set', () => {
    const preview = parseImport(toCsv({ ...snapshot, settings: { theme: 'system' } }));
    expect(preview.data.settings).toEqual({ theme: 'system' });
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
