import { describe, expect, it } from 'vitest';
import type { Entry } from '../types';
import { buildSuggestions, suggest } from './suggest';

const entries: Entry[] = [
  ['Karak', 1], ['karak', 2], ['Karak ', 3], ['Lunch', 4], ['Lunch', 5],
  ['Groceries', 6], ['Petrol', 7], ['Iced karak', 8], ['Bakery', 9],
].map(([description, createdAt], i) => ({
  id: String(i),
  date: '2026-11-01',
  amountFils: 1000,
  description: description as string,
  type: 'spend',
  createdAt: createdAt as number,
}));

describe('suggestions', () => {
  const ranked = buildSuggestions(entries);

  it('ranks by frequency, then recency', () => {
    expect(ranked.map((s) => s.label)).toEqual(['Karak', 'Lunch', 'Bakery', 'Iced karak', 'Petrol', 'Groceries']);
  });

  it('shows the most frequent when nothing is typed', () => {
    expect(suggest(ranked, '', 2).map((s) => s.label)).toEqual(['Karak', 'Lunch']);
  });

  it('puts prefix matches before word and substring matches', () => {
    expect(suggest(ranked, 'ka').map((s) => s.label)).toEqual(['Karak', 'Iced karak']);
    expect(suggest(ranked, 'ker').map((s) => s.label)).toEqual(['Bakery']);
  });

  it('is case-insensitive and drops exact matches', () => {
    expect(suggest(ranked, 'LUN').map((s) => s.label)).toEqual(['Lunch']);
    expect(suggest(ranked, 'lunch')).toEqual([]);
  });
});
