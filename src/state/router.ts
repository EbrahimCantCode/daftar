import { signal } from '@preact/signals';

export type Route = 'ledger' | 'monthly' | 'settings';

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  return path === 'monthly' || path === 'settings' ? path : 'ledger';
}

export const route = signal<Route>(parse(location.hash));

window.addEventListener('hashchange', () => {
  route.value = parse(location.hash);
  window.scrollTo(0, 0);
});

export function href(r: Route): string {
  return r === 'ledger' ? '#/' : `#/${r}`;
}
