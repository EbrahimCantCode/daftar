// Per-device conveniences in localStorage (remembered toggles, dismissed banners).
// Storage can be unavailable (private mode, cleared site data), so every call is
// wrapped and falls back quietly. Never use this for ledger data: that lives in IndexedDB.

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered this time; the UI still works.
  }
}

export const PREF_KEYS = {
  reportIncludeEntries: 'daftar:report-include-entries',
  reportDismissed: 'daftar:report-dismissed',
  paydayDismissed: 'daftar:payday-dismissed',
} as const;
