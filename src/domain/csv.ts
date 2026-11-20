import {
  DEFAULT_SETTINGS,
  SCHEMA_VERSION,
  type DataSnapshot,
  type Entry,
  type LegacyRecurringItem,
  type LegacySettings,
  type RecurringItem,
  type Settings,
  type Theme,
} from './types';
import { isValidDate, isValidMonth } from './dates';
import { ENTRY_TYPE_IDS, RECURRING_TYPE_IDS, isEntryType, isRecurringType } from './entryTypes';
import { migrateToV2, type LegacySnapshot } from './migrate';
import { filsToPlain, parseFils } from './money';
import { cleanDescription } from './text';

// One CSV holds everything. The `kind` column says what each row is:
//   entry     — a ledger entry
//   recurring — a recurring item
//   setting   — the single settings row
// Columns that do not apply to a row's kind are left empty.
//
// Files written by the first version (calendar months) have `next_month` and
// `income` instead of `next_cycle` and `payday_day`; they're migrated on import.
// The same columns let a pre-migration backup be written from version-1 data.

export const CSV_COLUMNS = [
  'kind',
  'id',
  'date',
  'amount',
  'description',
  'type',
  'salary',
  'recurring_id',
  'recurring_cycle',
  'created_at',
  'name',
  'timing',
  'day_of_month',
  'active',
  'next_cycle',
  'payday_day',
  'usual_salary',
  'starting_savings',
  'theme',
  'daily_goal',
  'daily_goal_since',
  // version-1 columns
  'next_month',
  'income',
] as const;
type Column = (typeof CSV_COLUMNS)[number];
type Row = Partial<Record<Column, string>>;

const BOM = '﻿';

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) || /^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function line(row: Row): string {
  return CSV_COLUMNS.map((c) => escapeCell(row[c] ?? '')).join(',');
}

const plain = (fils: number | undefined) => (fils === undefined ? '' : filsToPlain(fils));

/** Writes everything to CSV. Accepts version-1 data too, for the backup taken before migrating. */
export function toCsv(data: DataSnapshot | LegacySnapshot): string {
  const rows: Row[] = [];
  const s = data.settings as Partial<Settings & LegacySettings>;
  rows.push({
    kind: 'setting',
    payday_day: s.paydayDay === undefined ? '' : String(s.paydayDay),
    usual_salary: plain(s.usualSalaryFils),
    starting_savings: plain(s.startingSavingsFils),
    income: plain(s.monthlyIncomeFils),
    theme: s.theme,
    daily_goal: plain(s.dailyGoalFils),
    daily_goal_since: s.dailyGoalSince ?? '',
  });
  for (const r of data.recurring) {
    const row: Row = {
      kind: 'recurring',
      id: r.id,
      amount: filsToPlain(r.amountFils),
      type: r.type,
      created_at: new Date(r.createdAt).toISOString(),
      name: r.name,
      day_of_month: String(r.dayOfMonth),
      active: String(r.active),
    };
    if ('nextCycle' in r) {
      row.timing = r.timing;
      row.next_cycle = r.nextCycle;
    } else {
      row.next_month = r.nextMonth;
    }
    rows.push(row);
  }
  const entries = [...data.entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  for (const e of entries) {
    rows.push({
      kind: 'entry',
      id: e.id,
      date: e.date,
      amount: filsToPlain(e.amountFils),
      description: e.description,
      type: e.type,
      salary: e.salary ? 'true' : '',
      recurring_id: e.recurringId ?? '',
      recurring_cycle: e.recurringCycle ?? '',
      created_at: new Date(e.createdAt).toISOString(),
    });
  }
  return BOM + [CSV_COLUMNS.join(','), ...rows.map(line)].join('\r\n') + '\r\n';
}

/** RFC 4180 parser. Returns rows of cells, each tagged with its 1-based starting line number. */
export function parseCsvRows(text: string): { line: number; cells: string[] }[] {
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  const out: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let lineNo = 1;
  let rowStart = 1;
  let sawAnything = false;

  const endRow = () => {
    cells.push(cell);
    if (sawAnything) out.push({ line: rowStart, cells });
    cells = [];
    cell = '';
    sawAnything = false;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') lineNo++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      sawAnything = true;
    } else if (ch === ',') {
      cells.push(cell);
      cell = '';
      sawAnything = true;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
      lineNo++;
      rowStart = lineNo;
    } else {
      cell += ch;
      if (ch.trim()) sawAnything = true;
    }
  }
  if (inQuotes) throw new Error(`Unclosed quote starting on line ${rowStart}`);
  endRow();
  return out;
}

export interface ImportError {
  line: number;
  message: string;
}

export interface ImportPreview {
  /** Always in the current format: version-1 files are migrated while parsing. */
  data: DataSnapshot;
  /** True when the file contained a settings row. */
  hasSettings: boolean;
  /** True when the file was written by the first version (calendar months). */
  legacy: boolean;
  errors: ImportError[];
  firstDate?: string;
  lastDate?: string;
}

const THEMES = new Set(['system', 'light', 'dark']);
const list = (ids: string[]) => `${ids.slice(0, -1).join(', ')} or ${ids[ids.length - 1]}`;

function parseTimestamp(value: string): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** Parses and validates a CSV produced by toCsv. Any error means nothing should be imported. */
export function parseImport(text: string, now: number = Date.now()): ImportPreview {
  const errors: ImportError[] = [];
  const entries: Entry[] = [];
  const recurring: (RecurringItem | LegacyRecurringItem)[] = [];
  let settings: Settings | LegacySettings = { ...DEFAULT_SETTINGS };
  let hasSettings = false;
  let legacy = false;
  const empty = (): ImportPreview => ({ data: { entries: [], recurring: [], settings: { ...DEFAULT_SETTINGS } }, hasSettings, legacy, errors });

  let rows: { line: number; cells: string[] }[];
  try {
    rows = parseCsvRows(text);
  } catch (err) {
    errors.push({ line: 0, message: (err as Error).message });
    return empty();
  }
  const header = rows.shift();
  if (!header) {
    errors.push({ line: 1, message: 'The file is empty.' });
    return empty();
  }

  const index = new Map(header.cells.map((name, i) => [name.trim().toLowerCase(), i]));
  const missing = ['kind', 'id', 'date', 'amount', 'description', 'type'].filter((c) => !index.has(c));
  if (missing.length) {
    errors.push({ line: header.line, message: `This doesn't look like a Daftar export (missing columns: ${missing.join(', ')}).` });
    return empty();
  }
  const get = (cells: string[], col: Column) => {
    const i = index.get(col);
    return i === undefined ? '' : (cells[i] ?? '').trim();
  };

  const entryIds = new Set<string>();
  const recurringIds = new Set<string>();

  for (const { line, cells } of rows) {
    const err = (message: string) => errors.push({ line, message });
    const kind = get(cells, 'kind').toLowerCase();

    if (kind === 'entry') {
      const id = get(cells, 'id');
      const date = get(cells, 'date');
      const amountFils = parseFils(get(cells, 'amount'));
      const description = cleanDescription(get(cells, 'description'));
      const type = get(cells, 'type').toLowerCase();
      const recurringId = get(cells, 'recurring_id');
      const recurringCycle = get(cells, 'recurring_cycle');
      const createdAt = parseTimestamp(get(cells, 'created_at')) ?? now;
      const before = errors.length;
      if (!id) err('Entry is missing an id.');
      else if (entryIds.has(id)) err(`Duplicate entry id "${id}".`);
      if (!isValidDate(date)) err(`Invalid date "${date}" (expected YYYY-MM-DD).`);
      if (amountFils === null) err(`Invalid amount "${get(cells, 'amount')}".`);
      if (!description) err('Entry is missing a description.');
      if (!isEntryType(type)) err(`Invalid type "${type}" (expected ${list(ENTRY_TYPE_IDS)}).`);
      if (recurringCycle && !isValidMonth(recurringCycle)) err(`Invalid recurring_cycle "${recurringCycle}" (expected YYYY-MM).`);
      if (errors.length === before && isEntryType(type)) {
        const entry: Entry = { id, date, amountFils: amountFils!, description, type, createdAt };
        if (type === 'income' && get(cells, 'salary').toLowerCase() === 'true') entry.salary = true;
        if (recurringId) entry.recurringId = recurringId;
        if (recurringCycle) entry.recurringCycle = recurringCycle;
        entries.push(entry);
      }
      if (id) entryIds.add(id);
    } else if (kind === 'recurring') {
      const id = get(cells, 'id');
      const name = cleanDescription(get(cells, 'name'));
      const amountFils = parseFils(get(cells, 'amount'));
      const day = Number(get(cells, 'day_of_month'));
      const type = get(cells, 'type').toLowerCase();
      const active = get(cells, 'active').toLowerCase();
      const nextCycle = get(cells, 'next_cycle');
      const nextMonth = get(cells, 'next_month');
      const timing = get(cells, 'timing').toLowerCase() || 'day';
      const createdAt = parseTimestamp(get(cells, 'created_at')) ?? now;
      const before = errors.length;
      if (!id) err('Recurring item is missing an id.');
      else if (recurringIds.has(id)) err(`Duplicate recurring id "${id}".`);
      if (!name) err('Recurring item is missing a name.');
      if (amountFils === null) err(`Invalid amount "${get(cells, 'amount')}".`);
      if (!Number.isInteger(day) || day < 1 || day > 31) err(`Invalid day of month "${get(cells, 'day_of_month')}".`);
      if (!isRecurringType(type)) err(`Invalid type "${type}" (expected ${list(RECURRING_TYPE_IDS)}).`);
      if (active !== 'true' && active !== 'false') err(`Invalid active value "${active}" (expected true or false).`);
      if (timing !== 'day' && timing !== 'payday') err(`Invalid timing "${timing}" (expected day or payday).`);
      if (!isValidMonth(nextCycle || nextMonth)) err(`Invalid next_cycle "${nextCycle}" (expected YYYY-MM).`);
      if (errors.length === before && isRecurringType(type)) {
        const common = { id, name, amountFils: amountFils!, dayOfMonth: day, type, active: active === 'true', createdAt };
        if (nextCycle) {
          recurring.push({ ...common, timing: timing as RecurringItem['timing'], nextCycle });
        } else {
          recurring.push({ ...common, nextMonth });
          legacy = true;
        }
      }
      if (id) recurringIds.add(id);
    } else if (kind === 'setting') {
      if (hasSettings) {
        err('More than one settings row.');
        continue;
      }
      hasSettings = true;
      const theme = get(cells, 'theme').toLowerCase() || 'system';
      if (!THEMES.has(theme)) err(`Invalid theme "${theme}".`);
      const amount = (col: Column, label: string): number | undefined => {
        const v = get(cells, col);
        if (!v) return undefined;
        const fils = parseFils(v);
        if (fils === null) err(`Invalid ${label} "${v}".`);
        return fils ?? undefined;
      };
      const paydayText = get(cells, 'payday_day');
      let s: Settings | LegacySettings;
      if (paydayText) {
        const paydayDay = Number(paydayText);
        if (!Number.isInteger(paydayDay) || paydayDay < 1 || paydayDay > 31) err(`Invalid payday_day "${paydayText}".`);
        const v2: Settings = { theme: theme as Theme, paydayDay, schemaVersion: SCHEMA_VERSION };
        const salary = amount('usual_salary', 'usual salary');
        if (salary !== undefined) v2.usualSalaryFils = salary;
        const startingSavings = amount('starting_savings', 'starting savings');
        if (startingSavings !== undefined) v2.startingSavingsFils = startingSavings;
        s = v2;
      } else {
        legacy = true;
        const v1: LegacySettings = { theme: theme as Theme };
        const income = amount('income', 'income');
        if (income !== undefined) v1.monthlyIncomeFils = income;
        s = v1;
      }
      const goal = get(cells, 'daily_goal');
      if (goal) {
        const fils = parseFils(goal);
        const since = get(cells, 'daily_goal_since');
        if (fils === null) err(`Invalid daily goal "${goal}".`);
        else if (!isValidDate(since)) err(`Invalid daily_goal_since "${since}" (expected YYYY-MM-DD).`);
        else {
          s.dailyGoalFils = fils;
          s.dailyGoalSince = since;
        }
      }
      settings = s;
    } else {
      err(`Unknown row kind "${get(cells, 'kind')}" (expected entry, recurring or setting).`);
    }
  }

  let data: DataSnapshot;
  if (legacy) {
    const v1Settings: LegacySettings = 'paydayDay' in settings ? { theme: settings.theme } : settings;
    data = migrateToV2({ entries, recurring, settings: v1Settings }, []).data;
    // A version-1 file never asks to log a salary again on import.
    delete data.settings.salaryOfferPending;
  } else {
    data = { entries, recurring: recurring as RecurringItem[], settings: settings as Settings };
  }
  const dates = data.entries.map((e) => e.date).sort();
  return { data, hasSettings, legacy, errors, firstDate: dates[0], lastDate: dates[dates.length - 1] };
}
