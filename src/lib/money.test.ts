import { describe, expect, it } from 'vitest';
import { filsToPlain, formatFils, parseFils } from './money';

describe('parseFils', () => {
  it.each([
    ['3', 3000],
    ['3.5', 3500],
    ['3.25', 3250],
    ['3.250', 3250],
    ['0.005', 5],
    ['.5', 500],
    ['5.', 5000],
    ['007.100', 7100],
    [' 12.500 ', 12500],
    ['12.500 BD', 12500],
    ['12.5bhd', 12500],
    ['1,250', 1_250_000],
    ['1,250.750', 1_250_750],
    ['3,5', 3500],
    ['3,25', 3250],
    ['٣٫٢٥٠', 3250],
    ['١٢', 12000],
  ])('parses %j as %i fils', (input, fils) => {
    expect(parseFils(input)).toBe(fils);
  });

  it.each(['', ' ', '.', 'abc', '3.2500', '3.0001', '-3', '0', '0.000', '1.2.3', '3,5,0', '1234,500', '1e3', 'NaN', 'Infinity'])(
    'rejects %j',
    (input) => {
      expect(parseFils(input)).toBeNull();
    },
  );

  it('never produces floating point error', () => {
    // 0.1 + 0.2 style traps: every value 0.001..9.999 must round-trip exactly.
    for (let fils = 1; fils < 10_000; fils++) {
      expect(parseFils(filsToPlain(fils))).toBe(fils);
    }
  });

  it('rejects amounts beyond the safe limit', () => {
    expect(parseFils('99999999999')).toBeNull();
    expect(parseFils('1000000000')).toBe(1_000_000_000_000);
  });
});

describe('formatFils', () => {
  it.each([
    [12500, '12.500 BD'],
    [5, '0.005 BD'],
    [0, '0.000 BD'],
    [1_234_500, '1,234.500 BD'],
    [1_000_000_000, '1,000,000.000 BD'],
    [-12500, '−12.500 BD'],
  ])('formats %i as %j', (fils, text) => {
    expect(formatFils(fils)).toBe(text);
  });

  it('can omit the unit', () => {
    expect(formatFils(3250, { unit: false })).toBe('3.250');
  });

  it('refuses non-integer input', () => {
    expect(() => formatFils(1.5)).toThrow(TypeError);
  });
});

describe('filsToPlain', () => {
  it('formats without grouping or unit', () => {
    expect(filsToPlain(1_234_500)).toBe('1234.500');
    expect(filsToPlain(-500)).toBe('-0.500');
  });
});
