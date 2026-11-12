import { DEFAULT_SETTINGS, type DataSnapshot, type Entry, type RecurringItem, type Settings, type Theme } from '../types';
import { isValidDate, isValidMonth } from './dates';
import { filsToPlain, parseFils } from './money';
import { cleanDescription } from './text';

// One CSV holds everything. The `kind` column says what each row is:
//   entry     — a ledger entry
//   recurring — a monthly recurring item
//   setting   — the single settings row (income, theme, daily goal)
// Columns that do not apply to a row's kind are left empty.

export const CSV_COLUMNS = [
  'kind',
  'id',
  'date',
  'amount',
  'description',
  'type',
  'recurring_id',
  'created_at',
  'name',
  'day_of_month',
  'active',
  'next_month',
  'income',
  'theme',
  'daily_goal',
  'daily_goal_since',
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

export function toCsv(data: DataSnapshot): string {
  const rows: Row[] = [];
  rows.push({
    kind: 'setting',
    income: data.settings.monthlyIncomeFils === undefined ? '' : filsToPlain(data.settings.monthlyIncomeFils),
    theme: data.settings.theme,
    daily_goal: data.settings.dailyGoalFils === undefined ? '' : filsToPlain(data.settings.dailyGoalFils),
    daily_goal_since: data.settings.dailyGoalSince ?? '',
  });
  for (const r of data.recurring) {
    rows.push({
      kind: 'recurring',
      id: r.id,
      amount: filsToPlain(r.amountFils),
      type: r.type,
      created_at: new Date(r.createdAt).toISOString(),
      name: r.name,
      day_of_month: String(r.dayOfMonth),
      active: String(r.active),
      next_month: r.nextMonth,
    });
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
      recurring_id: e.recurringId ?? '',
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
  data: DataSnapshot;
  /** True when the file contained a settings row. */
  hasSettings: boolean;
  errors: ImportError[];
  firstDate?: string;
  lastDate?: string;
}

const ENTRY_TYPES = new Set(['spend', 'fixed', 'savings']);
const RECURRING_TYPES = new Set(['fixed', 'savings']);
const THEMES = new Set(['system', 'light', 'dark']);

function parseTimestamp(value: string): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/** Parses and validates a CSV produced by toCsv. Any error means nothing should be imported. */
export function parseImport(text: string, now: number = Date.now()): ImportPreview {
  const errors: ImportError[] = [];
  const data: DataSnapshot = { entries: [], recurring: [], settings: { ...DEFAULT_SETTINGS } };
  let hasSettings = false;

  let rows: { line: number; cells: string[] }[];
  try {
    rows = parseCsvRows(text);
  } catch (err) {
    return { data, hasSettings, errors: [{ line: 0, message: (err as Error).message }] };
  }
  const header = rows.shift();
  if (!header) return { data, hasSettings, errors: [{ line: 1, message: 'The file is empty.' }] };

  const index = new Map(header.cells.map((name, i) => [name.trim().toLowerCase(), i]));
  const missing = ['kind', 'id', 'date', 'amount', 'description', 'type'].filter((c) => !index.has(c));
  if (missing.length) {
    return {
      data,
      hasSettings,
      errors: [{ line: header.line, message: `This doesn't look like a Daftar export (missing columns: ${missing.join(', ')}).` }],
    };
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
      const createdAt = parseTimestamp(get(cells, 'created_at')) ?? now;
      if (!id) err('Entry is missing an id.');
      else if (entryIds.has(id)) err(`Duplicate entry id "${id}".`);
      if (!isValidDate(date)) err(`Invalid date "${date}" (expected YYYY-MM-DD).`);
      if (amountFils === null) err(`Invalid amount "${get(cells, 'amount')}".`);
      if (!description) err('Entry is missing a description.');
      if (!ENTRY_TYPES.has(type)) err(`Invalid type "${type}" (expected spend, fixed or savings).`);
      if (id && !entryIds.has(id) && isValidDate(date) && amountFils !== null && description && ENTRY_TYPES.has(type)) {
        const entry: Entry = { id, date, amountFils, description, type: type as Entry['type'], createdAt };
        if (recurringId) entry.recurringId = recurringId;
        data.entries.push(entry);
      }
      if (id) entryIds.add(id);
    } else if (kind === 'recurring') {
      const id = get(cells, 'id');
      const name = cleanDescription(get(cells, 'name'));
      const amountFils = parseFils(get(cells, 'amount'));
      const day = Number(get(cells, 'day_of_month'));
      const type = get(cells, 'type').toLowerCase();
      const active = get(cells, 'active').toLowerCase();
      const nextMonth = get(cells, 'next_month');
      const createdAt = parseTimestamp(get(cells, 'created_at')) ?? now;
      const before = errors.length;
      if (!id) err('Recurring item is missing an id.');
      else if (recurringIds.has(id)) err(`Duplicate recurring id "${id}".`);
      if (!name) err('Recurring item is missing a name.');
      if (amountFils === null) err(`Invalid amount "${get(cells, 'amount')}".`);
      if (!Number.isInteger(day) || day < 1 || day > 31) err(`Invalid day of month "${get(cells, 'day_of_month')}".`);
      if (!RECURRING_TYPES.has(type)) err(`Invalid type "${type}" (expected fixed or savings).`);
      if (active !== 'true' && active !== 'false') err(`Invalid active value "${active}" (expected true or false).`);
      if (!isValidMonth(nextMonth)) err(`Invalid next_month "${nextMonth}" (expected YYYY-MM).`);
      if (errors.length === before) {
        const item: RecurringItem = {
          id,
          name,
          amountFils: amountFils!,
          dayOfMonth: day,
          type: type as RecurringItem['type'],
          active: active === 'true',
          nextMonth,
          createdAt,
        };
        data.recurring.push(item);
      }
      if (id) recurringIds.add(id);
    } else if (kind === 'setting') {
      if (hasSettings) {
        err('More than one settings row.');
        continue;
      }
      hasSettings = true;
      const income = get(cells, 'income');
      const theme = get(cells, 'theme').toLowerCase() || 'system';
      const settings: Settings = { theme: theme as Theme };
      if (income) {
        const fils = parseFils(income);
        if (fils === null) err(`Invalid income "${income}".`);
        else settings.monthlyIncomeFils = fils;
      }
      if (!THEMES.has(theme)) err(`Invalid theme "${theme}".`);
      const goal = get(cells, 'daily_goal');
      if (goal) {
        const fils = parseFils(goal);
        const since = get(cells, 'daily_goal_since');
        if (fils === null) err(`Invalid daily goal "${goal}".`);
        else if (!isValidDate(since)) err(`Invalid daily_goal_since "${since}" (expected YYYY-MM-DD).`);
        else {
          settings.dailyGoalFils = fils;
          settings.dailyGoalSince = since;
        }
      }
      data.settings = settings;
    } else {
      err(`Unknown row kind "${get(cells, 'kind')}" (expected entry, recurring or setting).`);
    }
  }

  const dates = data.entries.map((e) => e.date).sort();
  return { data, hasSettings, errors, firstDate: dates[0], lastDate: dates[dates.length - 1] };
}
