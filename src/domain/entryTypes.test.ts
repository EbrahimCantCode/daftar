import { describe, expect, it } from 'vitest';
import { ENTRY_TYPES, ENTRY_TYPE_IDS, inkVar, isEntryType, isRecurringType } from './entryTypes';

describe('entry type registry', () => {
  it('describes every type once, with ink from tokens', () => {
    expect(ENTRY_TYPE_IDS).toEqual(['spend', 'fixed', 'savings']);
    for (const id of ENTRY_TYPE_IDS) {
      expect(ENTRY_TYPES[id].id).toBe(id);
      expect(ENTRY_TYPES[id].ink).toMatch(/^--ink-/);
      expect(ENTRY_TYPES[id].highlight).toMatch(/^--highlight-/);
    }
  });

  it('validates type strings', () => {
    expect(isEntryType('spend')).toBe(true);
    expect(isEntryType('food')).toBe(false);
    expect(isEntryType('toString')).toBe(false);
    expect(isRecurringType('savings')).toBe(true);
    expect(isRecurringType('spend')).toBe(false);
  });

  it('builds CSS variable references', () => {
    expect(inkVar('savings')).toBe('var(--ink-savings)');
  });
});
