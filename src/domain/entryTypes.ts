import type { EntryType, RecurringType } from './types';

/**
 * The one place entry types are described. UI reads labels, ink and icons from here;
 * CSV and validation use the id list. Ink values are CSS custom-property names from
 * ui/tokens.css, so colours stay in the tokens file.
 */
export interface EntryTypeDef {
  id: EntryType;
  /** Shown on toggles and in reports. */
  label: string;
  /** Lower-case form for screen-reader hints, e.g. "(spend)". */
  srLabel: string;
  /** Token for text ink, e.g. '--ink-spend'. */
  ink: string;
  /** Token for highlighter bars behind rows of this type. */
  highlight: string;
  /** Icon name from ui/components/Icon. */
  icon: string;
}

export const ENTRY_TYPES: Record<EntryType, EntryTypeDef> = {
  spend: { id: 'spend', label: 'Spend', srLabel: 'spend', ink: '--ink-spend', highlight: '--highlight-blue', icon: 'pen' },
  fixed: { id: 'fixed', label: 'Fixed', srLabel: 'fixed', ink: '--ink-fixed', highlight: '--highlight-pencil', icon: 'repeat' },
  savings: { id: 'savings', label: 'Savings', srLabel: 'savings', ink: '--ink-savings', highlight: '--highlight-green', icon: 'download' },
};

export const ENTRY_TYPE_IDS = Object.keys(ENTRY_TYPES) as EntryType[];
export const RECURRING_TYPE_IDS: RecurringType[] = ['fixed', 'savings'];

export function isEntryType(value: string): value is EntryType {
  return Object.hasOwn(ENTRY_TYPES, value);
}

export function isRecurringType(value: string): value is RecurringType {
  return (RECURRING_TYPE_IDS as string[]).includes(value);
}

/** `var(--ink-…)` for a type, ready for a style attribute. */
export function inkVar(type: EntryType): string {
  return `var(${ENTRY_TYPES[type].ink})`;
}

export function highlightVar(type: EntryType): string {
  return `var(${ENTRY_TYPES[type].highlight})`;
}
