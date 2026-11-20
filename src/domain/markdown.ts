import { formatFils } from './money';

// Shared pieces for the Markdown reports.

export const DASH = '–';
const MINUS = '−';

/** "21 Nov 2026" */
export function longDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "26 Oct" */
export function shortDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Escapes text for a Markdown table cell. */
export function cell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

export function mdTable(header: string[], rows: string[][]): string {
  return [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/** "+1.250 BD (+12%)", "−0.500 BD (−4%)", or "0.000 BD". */
export function change(current: number, previous: number): string {
  const diff = current - previous;
  if (diff === 0) return formatFils(0);
  const sign = diff > 0 ? '+' : MINUS;
  let text = `${sign}${formatFils(Math.abs(diff))}`;
  if (previous !== 0) {
    const pct = Math.round((Math.abs(diff) * 100) / Math.abs(previous));
    if (pct > 0) text += ` (${sign}${pct}%)`;
  }
  return text;
}

/** A share as a whole percentage, or "–" when there is no whole to share. */
export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part * 100) / whole)}%` : DASH;
}

export const byDateThenCreated = (a: { date: string; createdAt: number }, b: { date: string; createdAt: number }) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt;
