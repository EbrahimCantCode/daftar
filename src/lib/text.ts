/** Grouping key for descriptions: trimmed, single-spaced, case-insensitive. */
export function descriptionKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function cleanDescription(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

interface Spelling {
  label: string;
  count: number;
  last: number;
}

/** Tracks how often each spelling of a key is used, to label a group with its most common one. */
export class SpellingTally {
  private spellings = new Map<string, Spelling>();

  add(raw: string, at: number): void {
    const label = cleanDescription(raw);
    const s = this.spellings.get(label);
    if (s) {
      s.count++;
      s.last = Math.max(s.last, at);
    } else {
      this.spellings.set(label, { label, count: 1, last: at });
    }
  }

  best(): string {
    let best: Spelling | undefined;
    for (const s of this.spellings.values()) {
      if (!best || s.count > best.count || (s.count === best.count && s.last > best.last)) best = s;
    }
    return best?.label ?? '';
  }
}
