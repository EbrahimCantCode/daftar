import { signal } from '@preact/signals';
import { isValidMonth } from '../domain/dates';

export type Route = 'ledger' | 'where' | 'insights' | 'more' | 'monthly' | 'settings' | 'reports' | 'report' | 'year';

/** Top-level tabs, in tab-bar order. */
export const TABS = ['ledger', 'where', 'insights', 'more'] as const;
export type Tab = (typeof TABS)[number];

const SIMPLE: Route[] = ['where', 'insights', 'more', 'monthly', 'settings', 'reports'];

/** The cycle shown on the report screen (#/report/YYYY-MM). */
export const reportMonth = signal<string | null>(null);
/** The year shown on the year report screen (#/year/YYYY). */
export const reportYear = signal<string | null>(null);

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const report = /^report\/(\d{4}-\d{2})$/.exec(path);
  if (report && isValidMonth(report[1]!)) {
    reportMonth.value = report[1]!;
    return 'report';
  }
  const year = /^year\/(\d{4})$/.exec(path);
  if (year) {
    reportYear.value = year[1]!;
    return 'year';
  }
  return (SIMPLE as string[]).includes(path) ? (path as Route) : 'ledger';
}

export const route = signal<Route>(parse(location.hash));

window.addEventListener('hashchange', () => {
  route.value = parse(location.hash);
  window.scrollTo(0, 0);
});

export function href(r: Exclude<Route, 'report' | 'year'>): string {
  return r === 'ledger' ? '#/' : `#/${r}`;
}

export function reportHref(cycleKey: string): string {
  return `#/report/${cycleKey}`;
}

export function yearReportHref(year: string): string {
  return `#/year/${year}`;
}

/** Which tab a route belongs to, for the tab bar. */
export function tabOf(r: Route): Tab {
  if (r === 'ledger' || r === 'where' || r === 'insights') return r;
  return 'more';
}

// Set once the user has moved between screens, so "back" never leaves the app.
let navigatedInApp = false;
window.addEventListener('hashchange', () => {
  navigatedInApp = true;
});

/** Goes back within the app when there's somewhere to go back to, otherwise to `fallback`. */
export function goBack(fallback: string): void {
  if (navigatedInApp) history.back();
  else location.hash = fallback;
}
