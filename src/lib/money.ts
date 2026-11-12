// Money is always an integer number of fils. 1 BD = 1000 fils.
// Parsing works on the string's digits directly so no float ever touches an amount.

export const FILS_PER_DINAR = 1000;
/** Upper bound for a single amount: 1 billion BD. Keeps fils well inside Number.MAX_SAFE_INTEGER. */
export const MAX_FILS = 1_000_000_000 * FILS_PER_DINAR;

const MINUS = '−';

/** Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits and separators to ASCII. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.') // Arabic decimal separator
    .replace(/٬/g, ','); // Arabic thousands separator
}

/**
 * Parses user input such as "3", "3.5", "3.250", ".5", "1,250.000" or "12.500 BD"
 * into a positive integer number of fils. Returns null for anything invalid,
 * zero, negative, or with more than 3 decimal places.
 */
export function parseFils(input: string): number | null {
  let s = normalizeDigits(input).replace(/\s+/g, '').toLowerCase();
  s = s.replace(/(bhd|bd)$/, '');
  if (s === '') return null;

  if (s.includes(',')) {
    if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) {
      s = s.replace(/,/g, ''); // thousands separators
    } else if (/^\d+,\d{1,3}$/.test(s) && !/^\d+,\d{3}$/.test(s)) {
      s = s.replace(',', '.'); // "3,5" typed with a comma decimal key
    } else {
      return null;
    }
  }

  const match = /^(\d*)(?:\.(\d*))?$/.exec(s);
  if (!match) return null;
  const whole = match[1] ?? '';
  const frac = match[2] ?? '';
  if (whole === '' && frac === '') return null;
  if (frac.length > 3) return null;

  const wholeDigits = whole.replace(/^0+(?=\d)/, '');
  if (wholeDigits.length > 10) return null;
  const fils = Number(wholeDigits || '0') * FILS_PER_DINAR + Number(frac.padEnd(3, '0'));
  if (!Number.isSafeInteger(fils) || fils <= 0 || fils > MAX_FILS) return null;
  return fils;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "12.500" — no unit, no grouping. Used to prefill inputs and in CSV. */
export function filsToPlain(fils: number): string {
  assertFils(fils);
  const sign = fils < 0 ? '-' : '';
  const abs = Math.abs(fils);
  return `${sign}${Math.trunc(abs / FILS_PER_DINAR)}.${String(abs % FILS_PER_DINAR).padStart(3, '0')}`;
}

/** "1,234.500 BD", or "−12.500 BD" for negatives. */
export function formatFils(fils: number, opts: { unit?: boolean } = {}): string {
  assertFils(fils);
  const { unit = true } = opts;
  const sign = fils < 0 ? MINUS : '';
  const abs = Math.abs(fils);
  const whole = groupThousands(String(Math.trunc(abs / FILS_PER_DINAR)));
  const frac = String(abs % FILS_PER_DINAR).padStart(3, '0');
  return `${sign}${whole}.${frac}${unit ? ' BD' : ''}`;
}

function assertFils(fils: number): void {
  if (!Number.isSafeInteger(fils)) throw new TypeError(`Amount must be an integer number of fils, got ${fils}`);
}
