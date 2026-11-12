import { signal } from '@preact/signals';
import { isValidMonth } from '../lib/dates';

export type Route = 'ledger' | 'monthly' | 'settings' | 'report';

/** The month shown on the report screen (#/report/YYYY-MM). */
export const reportMonth = signal<string | null>(null);

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const report = /^report\/(\d{4}-\d{2})$/.exec(path);
  if (report && isValidMonth(report[1]!)) {
    reportMonth.value = report[1]!;
    return 'report';
  }
  return path === 'monthly' || path === 'settings' ? path : 'ledger';
}

export const route = signal<Route>(parse(location.hash));

window.addEventListener('hashchange', () => {
  route.value = parse(location.hash);
  window.scrollTo(0, 0);
});

export function href(r: Exclude<Route, 'report'>): string {
  return r === 'ledger' ? '#/' : `#/${r}`;
}

export function reportHref(month: string): string {
  return `#/report/${month}`;
}
