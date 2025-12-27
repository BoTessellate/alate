/**
 * Currency Conversion Utility
 * Uses Frankfurter API (free, no API key, daily ECB rates)
 * https://frankfurter.dev/
 */

// Supported currencies with their symbols
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  CNY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'Fr',
  SGD: 'S$',
  AED: 'د.إ',
  BRL: 'R$',
  MXN: '$',
  KRW: '₩',
  THB: '฿',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  NZD: 'NZ$',
  ZAR: 'R',
  HKD: 'HK$',
  PLN: 'zł',
  TRY: '₺',
  RUB: '₽',
  MYR: 'RM',
  PHP: '₱',
  IDR: 'Rp',
  CZK: 'Kč',
  HUF: 'Ft',
  ILS: '₪',
};

// Common display currencies for the toggle
export const DISPLAY_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD'] as const;
export type DisplayCurrency = typeof DISPLAY_CURRENCIES[number];

interface ExchangeRates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface CachedRates extends ExchangeRates {
  fetchedAt: number;
}

// Cache key for localStorage
const CACHE_KEY = 'moodlayer_exchange_rates';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached rates from localStorage
 */
function getCachedRates(): CachedRates | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedRates = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid (less than 24 hours old)
    if (now - parsed.fetchedAt < CACHE_DURATION_MS) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Save rates to localStorage cache
 */
function setCachedRates(rates: ExchangeRates): void {
  if (typeof window === 'undefined') return;

  try {
    const cached: CachedRates = {
      ...rates,
      fetchedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Fetch latest exchange rates from Frankfurter API
 * Uses USD as base currency for easy conversion
 */
export async function fetchExchangeRates(): Promise<ExchangeRates | null> {
  // Check cache first
  const cached = getCachedRates();
  if (cached) {
    return cached;
  }

  try {
    // Fetch rates with USD as base (most products use USD)
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD');

    if (!response.ok) {
      throw new Error(`Failed to fetch rates: ${response.status}`);
    }

    const data: ExchangeRates = await response.json();

    // Add USD to rates (it's 1:1 with itself)
    data.rates['USD'] = 1;

    // Cache the rates
    setCachedRates(data);

    return data;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    return null;
  }
}

/**
 * Convert amount from one currency to another
 * @param amount - The amount to convert
 * @param fromCurrency - Source currency code (e.g., 'INR')
 * @param toCurrency - Target currency code (e.g., 'USD')
 * @param rates - Exchange rates object (with USD as base)
 * @returns Converted amount or null if conversion not possible
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRates
): number | null {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // Same currency, no conversion needed
  if (from === to) return amount;

  // Get rates (rates are relative to USD base)
  const fromRate = rates.rates[from];
  const toRate = rates.rates[to];

  if (fromRate === undefined || toRate === undefined) {
    console.warn(`Currency not supported: ${fromRate === undefined ? from : to}`);
    return null;
  }

  // Convert: amount in FROM -> USD -> TO
  // If base is USD: fromRate is how many FROM per 1 USD
  // So: amount / fromRate = amount in USD
  // Then: (amount in USD) * toRate = amount in TO
  const amountInUSD = amount / fromRate;
  const converted = amountInUSD * toRate;

  return converted;
}

/**
 * Format a price with currency symbol
 * @param price - The price amount
 * @param currency - Currency code
 * @param options - Formatting options
 */
export function formatPrice(
  price: number,
  currency: string = 'USD',
  options: {
    showApproximate?: boolean;
    locale?: string;
  } = {}
): string {
  const { showApproximate = false, locale = 'en-US' } = options;
  const currencyUpper = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[currencyUpper] || currencyUpper;

  // Format the number with locale
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: currencyUpper === 'JPY' || currencyUpper === 'KRW' ? 0 : 2,
  }).format(price);

  // Add approximate indicator if needed
  const prefix = showApproximate ? '~' : '';

  // Some currencies put symbol after (like EUR in some locales)
  // For simplicity, we'll always put symbol before
  return `${prefix}${symbol}${formatted}`;
}

/**
 * Format price with optional conversion
 * This is the main function to use in components
 */
export function formatPriceWithConversion(
  price: number,
  originalCurrency: string = 'USD',
  displayCurrency: string | null,
  rates: ExchangeRates | null
): { formatted: string; isConverted: boolean } {
  const from = originalCurrency.toUpperCase();
  const to = displayCurrency?.toUpperCase() || from;

  // No conversion needed or no rates available
  if (!displayCurrency || from === to || !rates) {
    return {
      formatted: formatPrice(price, from),
      isConverted: false,
    };
  }

  // Convert the price
  const converted = convertCurrency(price, from, to, rates);

  if (converted === null) {
    // Conversion failed, show original
    return {
      formatted: formatPrice(price, from),
      isConverted: false,
    };
  }

  return {
    formatted: formatPrice(converted, to),
    isConverted: true,
  };
}

/**
 * Get the currency symbol for a currency code
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
}
