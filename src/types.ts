export type EntryType = 'spend' | 'fixed' | 'savings';
export type RecurringType = 'fixed' | 'savings';
export type Theme = 'system' | 'light' | 'dark';

export interface Entry {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Integer number of fils (1 BD = 1000 fils). */
  amountFils: number;
  description: string;
  type: EntryType;
  recurringId?: string;
  /** Epoch milliseconds. */
  createdAt: number;
}

export interface RecurringItem {
  id: string;
  name: string;
  amountFils: number;
  /** 1–31; clamped to the last day of shorter months. */
  dayOfMonth: number;
  type: RecurringType;
  active: boolean;
  /** YYYY-MM: the first month that has not been generated yet. */
  nextMonth: string;
  createdAt: number;
}

export interface Settings {
  monthlyIncomeFils?: number;
  /** Daily spending goal; only "spend" entries count toward it. */
  dailyGoalFils?: number;
  /** YYYY-MM-DD the goal was first set; streak days before this don't count. */
  dailyGoalSince?: string;
  theme: Theme;
}

export interface DataSnapshot {
  entries: Entry[];
  recurring: RecurringItem[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system' };
