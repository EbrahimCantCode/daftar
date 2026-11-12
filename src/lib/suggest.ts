import type { Entry } from '../types';
import { SpellingTally, descriptionKey } from './text';

export interface Suggestion {
  key: string;
  label: string;
  count: number;
  last: number;
}

/** One suggestion per distinct description, most frequent first (ties: most recent). */
export function buildSuggestions(entries: readonly Entry[]): Suggestion[] {
  const groups = new Map<string, { count: number; last: number; tally: SpellingTally }>();
  for (const e of entries) {
    const key = descriptionKey(e.description);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { count: 0, last: 0, tally: new SpellingTally() };
      groups.set(key, g);
    }
    g.count++;
    g.last = Math.max(g.last, e.createdAt);
    g.tally.add(e.description, e.createdAt);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.tally.best(), count: g.count, last: g.last }))
    .sort((a, b) => b.count - a.count || b.last - a.last);
}

/**
 * Filters the ranked list for what has been typed: whole-description prefix matches
 * first, then word-prefix matches, then substring matches; frequency order within each.
 * An exact match is left out, since there is nothing left to complete.
 */
export function suggest(ranked: readonly Suggestion[], query: string, limit = 6): Suggestion[] {
  const q = descriptionKey(query);
  if (!q) return ranked.slice(0, limit);
  const prefix: Suggestion[] = [];
  const wordPrefix: Suggestion[] = [];
  const contains: Suggestion[] = [];
  for (const s of ranked) {
    if (s.key === q) continue;
    if (s.key.startsWith(q)) prefix.push(s);
    else if (s.key.includes(` ${q}`)) wordPrefix.push(s);
    else if (s.key.includes(q)) contains.push(s);
  }
  return [...prefix, ...wordPrefix, ...contains].slice(0, limit);
}
