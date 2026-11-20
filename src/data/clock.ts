/**
 * The app's notion of "now". In development you can pretend it is another day with
 * `?today=YYYY-MM-DD` (remembered for the tab) to try out recurring backfill.
 */
let override: Date | null = null;

if (import.meta.env.DEV && typeof location !== 'undefined') {
  try {
    const param = new URLSearchParams(location.search).get('today');
    if (param) sessionStorage.setItem('daftar:today', param);
    const stored = sessionStorage.getItem('daftar:today');
    const m = stored && /^(\d{4})-(\d{2})-(\d{2})$/.exec(stored);
    if (m) override = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  } catch {
    // sessionStorage can be unavailable; just use the real clock.
  }
}

export function now(): Date {
  return override ? new Date(override) : new Date();
}
