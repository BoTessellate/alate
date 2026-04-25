/**
 * Currency formatting — symbol-only for consistent visual weight.
 *
 * Earlier inline version fell back to `${code} ` (e.g. "INR 5931")
 * which read as inconsistent against "£49" in the same UI. Now we
 * always render a glyph; if we don't recognise the currency code we
 * drop it entirely rather than display a 3-letter prefix.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  INR: '₹',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF ',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  SGD: 'S$',
  HKD: 'HK$',
  AED: 'د.إ',
};

/** Thin space (Unicode U+2009, ~1/6 em wide) used between currency
 *  symbol and amount. Tighter than a regular space (which reads ~5-6px
 *  wide at fontSize 15 serif with letterSpacing 0.3) but enough to
 *  keep "₹" from crowding the digit. Same convention as Apple's
 *  NumberFormatter and most editorial fonts. */
const THIN_SPACE = ' ';

export interface MoneyAmount {
  amount: number;
  currency: string;
}

/**
 * Format a `{ amount, currency }` pair as a display string. Returns
 * `null` for missing/invalid input — caller can elide the price field.
 */
export function formatPrice(price?: MoneyAmount | null): string | null {
  if (!price) return null;
  if (typeof price.amount !== 'number' || !Number.isFinite(price.amount)) {
    return null;
  }
  const sym = CURRENCY_SYMBOLS[price.currency] ?? '';
  return sym ? `${sym}${THIN_SPACE}${price.amount}` : `${price.amount}`;
}
