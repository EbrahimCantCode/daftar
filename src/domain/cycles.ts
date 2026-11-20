import type { Entry } from './types';
import { addDays, addMonths, clampedDate, monthLabel, monthOf } from './dates';

// Pay cycles replace calendar months.
//
// Every month has an expected payday P (settings.paydayDay, clamped to the month's
// length). Each P anchors one cycle. A salary entry dated from 7 days before P up to
// the day before the next payday's window belongs to that cycle, and the earliest one
// moves the cycle's start to its date (early or late). Without a salary the cycle
// starts on P. A cycle ends the day before the next cycle starts; for the open cycle,
// that's the day before the next expected payday (or the early salary, once logged).
//
// A cycle is named, and keyed, by the month it mostly covers: with paydays on the
// 16th or later that's the month after P (26 Oct – 25 Nov is "November"), otherwise
// P's own month. This never gives two cycles the same name.

export const EARLY_SALARY_DAYS = 7;

export interface Cycle {
  /** YYYY-MM of the month the cycle is named after. Unique per cycle. */
  key: string;
  /** Expected payday that anchors the cycle. */
  payday: string;
  /** First day (salary date, or the expected payday). */
  start: string;
  /** Last day, inclusive. */
  end: string;
  /** Date of the salary that started the cycle, when one was logged. */
  salaryDate?: string;
}

export interface CycleContext {
  paydayDay: number;
  /** Cycle key → date of the earliest salary in that cycle's window. */
  salaryStarts: ReadonlyMap<string, string>;
}

/** The month whose payday anchors cycle `key`. */
export function paydayMonthOf(key: string, paydayDay: number): string {
  return paydayDay >= 16 ? addMonths(key, -1) : key;
}

/** The cycle key anchored by the payday in `month`. */
export function keyForPaydayMonth(month: string, paydayDay: number): string {
  return paydayDay >= 16 ? addMonths(month, 1) : month;
}

export function expectedPayday(key: string, paydayDay: number): string {
  return clampedDate(paydayMonthOf(key, paydayDay), paydayDay);
}

/** First day a salary counts toward cycle `key`. */
function windowStart(key: string, paydayDay: number): string {
  return addDays(expectedPayday(key, paydayDay), -EARLY_SALARY_DAYS);
}

/** Which cycle a salary dated `date` belongs to. */
export function salaryCycleKey(date: string, paydayDay: number): string {
  let key = keyForPaydayMonth(monthOf(date), paydayDay);
  // Windows are about a month long, so at most one step either way.
  if (date < windowStart(key, paydayDay)) key = addMonths(key, -1);
  else if (date >= windowStart(addMonths(key, 1), paydayDay)) key = addMonths(key, 1);
  return key;
}

export function buildCycleContext(entries: readonly Entry[], paydayDay: number): CycleContext {
  const salaryStarts = new Map<string, string>();
  for (const e of entries) {
    if (e.type !== 'income' || !e.salary) continue;
    const key = salaryCycleKey(e.date, paydayDay);
    const current = salaryStarts.get(key);
    if (!current || e.date < current) salaryStarts.set(key, e.date);
  }
  return { paydayDay, salaryStarts };
}

function startOf(key: string, ctx: CycleContext): string {
  return ctx.salaryStarts.get(key) ?? expectedPayday(key, ctx.paydayDay);
}

export function cycleByKey(key: string, ctx: CycleContext): Cycle {
  const salaryDate = ctx.salaryStarts.get(key);
  const cycle: Cycle = {
    key,
    payday: expectedPayday(key, ctx.paydayDay),
    start: startOf(key, ctx),
    end: addDays(startOf(addMonths(key, 1), ctx), -1),
  };
  if (salaryDate) cycle.salaryDate = salaryDate;
  return cycle;
}

/** The cycle that contains `date`. */
export function cycleFor(date: string, ctx: CycleContext): Cycle {
  let key = keyForPaydayMonth(monthOf(date), ctx.paydayDay);
  for (let i = 0; i < 3; i++) {
    const cycle = cycleByKey(key, ctx);
    if (date < cycle.start) key = addMonths(key, -1);
    else if (date > cycle.end) key = addMonths(key, 1);
    else return cycle;
  }
  return cycleByKey(key, ctx);
}

/** Cycles from key `from` to key `to`, inclusive. */
export function cyclesBetween(from: string, to: string, ctx: CycleContext): Cycle[] {
  const out: Cycle[] = [];
  for (let key = from; key <= to; key = addMonths(key, 1)) out.push(cycleByKey(key, ctx));
  return out;
}

export function inCycle(date: string, cycle: Cycle): boolean {
  return date >= cycle.start && date <= cycle.end;
}

export function entriesInCycle(entries: readonly Entry[], cycle: Cycle): Entry[] {
  return entries.filter((e) => inCycle(e.date, cycle));
}

/** Number of days in the cycle. */
export function cycleLength(cycle: Cycle): number {
  return dayIndex(cycle, cycle.end) + 1;
}

/** 0-based day number of `date` within the cycle. */
export function dayIndex(cycle: Cycle, date: string): number {
  const [y1, m1, d1] = cycle.start.split('-').map(Number) as [number, number, number];
  const [y2, m2, d2] = date.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Days of the cycle that have happened by `today` (0 for a future cycle). */
export function daysElapsed(cycle: Cycle, today: string): number {
  if (today < cycle.start) return 0;
  if (today > cycle.end) return cycleLength(cycle);
  return dayIndex(cycle, today) + 1;
}

/**
 * Cycles from the one holding the earliest entry up to the current one, oldest first.
 * Empty when there are no entries.
 */
export function cyclesWithData(entries: readonly Entry[], ctx: CycleContext, today: string): Cycle[] {
  if (!entries.length) return [];
  let first = entries[0]!.date;
  for (const e of entries) if (e.date < first) first = e.date;
  const last = today > first ? today : first;
  return cyclesBetween(cycleFor(first, ctx).key, cycleFor(last, ctx).key, ctx);
}

// ---- Prompts ---------------------------------------------------------------

/** Days after a cycle starts during which a missing salary is still asked for. */
export const SALARY_PROMPT_DAYS = 10;

/**
 * Key of the cycle whose salary should be asked for today ("Got paid? Log your
 * salary"), or null. That's the next cycle from 7 days before its payday, or the
 * current one in its first days, as long as no salary has been logged for it.
 */
export function salaryDueCycle(today: string, ctx: CycleContext): string | null {
  const current = cycleFor(today, ctx);
  if (!current.salaryDate && dayIndex(current, today) < SALARY_PROMPT_DAYS) return current.key;
  const next = cycleByKey(addMonths(current.key, 1), ctx);
  if (!next.salaryDate && today >= addDays(next.payday, -EARLY_SALARY_DAYS)) return next.key;
  return null;
}

// ---- Labels ----------------------------------------------------------------

function shortDay(dateISO: string, withYear: boolean): string {
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "26 Oct – 25 Nov", or with years when the range crosses one. */
export function cycleRange(cycle: Cycle): string {
  const crosses = cycle.start.slice(0, 4) !== cycle.end.slice(0, 4);
  return `${shortDay(cycle.start, crosses)} – ${shortDay(cycle.end, crosses)}`;
}

/** "November", or "November 2025" when `today` is in another year. */
export function cycleName(cycle: Cycle, today?: string): string {
  const [name, year] = monthLabel(cycle.key).split(' ');
  return today && today.slice(0, 4) !== cycle.key.slice(0, 4) ? `${name} ${year}` : name!;
}

/** "November (26 Oct – 25 Nov)" */
export function cycleTitle(cycle: Cycle, today?: string): string {
  return `${cycleName(cycle, today)} (${cycleRange(cycle)})`;
}
