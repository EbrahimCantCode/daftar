/** 'withdrawal' is money taken out of savings to cover spending. */
export type EntryType = 'spend' | 'fixed' | 'savings' | 'income' | 'withdrawal';
export type RecurringType = 'fixed' | 'savings';
/** When a recurring item is written into a cycle: on the cycle's first day, or on a day of the month. */
export type RecurringTiming = 'payday' | 'day';
export type Theme = 'system' | 'light' | 'dark';

export interface Entry {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Integer number of fils (1 BD = 1000 fils). */
  amountFils: number;
  description: string;
  type: EntryType;
  /** Income only: this is the salary, so it starts a pay cycle. */
  salary?: boolean;
  recurringId?: string;
  /** Cycle key (YYYY-MM) this entry was posted for by the recurring planner. */
  recurringCycle?: string;
  /** Epoch milliseconds. */
  createdAt: number;
}

export interface RecurringItem {
  id: string;
  name: string;
  amountFils: number;
  timing: RecurringTiming;
  /** 1–31, used when timing is 'day'; clamped to the last day of shorter months. */
  dayOfMonth: number;
  type: RecurringType;
  active: boolean;
  /** Cycle key (YYYY-MM) of the first cycle that has not been posted yet. */
  nextCycle: string;
  createdAt: number;
}

export interface Settings {
  /** Day of the month the salary is expected (1–31, clamped in short months). */
  paydayDay: number;
  /** Prefills "Salary received". */
  usualSalaryFils?: number;
  /** Savings balance before the first savings entry; the balance is this + savings − withdrawals. */
  startingSavingsFils?: number;
  /** Daily spending goal; only "spend" entries count toward it. */
  dailyGoalFils?: number;
  /** YYYY-MM-DD the goal was first set; streak days before this don't count. */
  dailyGoalSince?: string;
  theme: Theme;
  /** 2 once the data uses pay cycles. Missing on data written by the first version. */
  schemaVersion?: number;
  /** Set by the migration: offer once to log the current cycle's salary. */
  salaryOfferPending?: boolean;
}

export interface DataSnapshot {
  entries: Entry[];
  recurring: RecurringItem[];
  settings: Settings;
}

/** How an import is applied: add to what's there, or wipe first. */
export type ImportMode = 'merge' | 'replace';

export const SCHEMA_VERSION = 2;
export const DEFAULT_PAYDAY = 26;
export const DEFAULT_SETTINGS: Settings = { theme: 'system', paydayDay: DEFAULT_PAYDAY, schemaVersion: SCHEMA_VERSION };

// ---- Data written by version 1 (calendar months) --------------------------

export interface LegacyRecurringItem {
  id: string;
  name: string;
  amountFils: number;
  dayOfMonth: number;
  type: RecurringType;
  active: boolean;
  /** YYYY-MM: the first calendar month not generated yet. */
  nextMonth: string;
  createdAt: number;
}

export interface LegacySettings {
  monthlyIncomeFils?: number;
  dailyGoalFils?: number;
  dailyGoalSince?: string;
  theme: Theme;
}
