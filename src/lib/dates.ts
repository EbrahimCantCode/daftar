// Dates are plain local calendar strings: "YYYY-MM-DD" for days, "YYYY-MM" for months.
// String comparison orders them correctly, and no timezone conversion is ever needed.

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonth(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function isValidMonth(month: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function isValidDate(dateISO: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

/** month1 is 1-based. */
export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function splitMonth(month: string): [number, number] {
  return [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
}

export function addMonths(month: string, n: number): string {
  const [y, m] = splitMonth(month);
  const index = y * 12 + (m - 1) + n;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

/** Inclusive list of months from `from` to `to`; empty when from > to. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** Date in `month` on `day`, clamped to the month's last day (31 → Feb 28/29). */
export function clampedDate(month: string, day: number): string {
  const [y, m] = splitMonth(month);
  return `${month}-${pad(Math.min(Math.max(1, day), daysInMonth(y, m)))}`;
}

export function monthLabel(month: string, opts: { short?: boolean } = {}): string {
  const [y, m] = splitMonth(month);
  return new Intl.DateTimeFormat('en-GB', {
    month: opts.short ? 'short' : 'long',
    year: opts.short ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** "Thursday 12 Nov" */
export function dayLabel(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}
