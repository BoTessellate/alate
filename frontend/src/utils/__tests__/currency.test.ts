/**
 * Currency Utility Tests
 * Tests for currency conversion, formatting, and caching functionality
 */

import {
  CURRENCY_SYMBOLS,
  DISPLAY_CURRENCIES,
  fetchExchangeRates,
  convertCurrency,
  formatPrice,
  formatPriceWithConversion,
  getCurrencySymbol,
} from '../currency';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock console methods
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe('CURRENCY_SYMBOLS', () => {
  it('contains symbols for major currencies', () => {
    expect(CURRENCY_SYMBOLS.USD).toBe('$');
    expect(CURRENCY_SYMBOLS.EUR).toBe('€');
    expect(CURRENCY_SYMBOLS.GBP).toBe('£');
    expect(CURRENCY_SYMBOLS.INR).toBe('₹');
    expect(CURRENCY_SYMBOLS.JPY).toBe('¥');
    expect(CURRENCY_SYMBOLS.CNY).toBe('¥');
  });

  it('contains symbols for regional currencies', () => {
    expect(CURRENCY_SYMBOLS.AUD).toBe('A$');
    expect(CURRENCY_SYMBOLS.CAD).toBe('C$');
    expect(CURRENCY_SYMBOLS.CHF).toBe('Fr');
    expect(CURRENCY_SYMBOLS.SGD).toBe('S$');
    expect(CURRENCY_SYMBOLS.AED).toBe('د.إ');
  });

  it('contains symbols for emerging market currencies', () => {
    expect(CURRENCY_SYMBOLS.BRL).toBe('R$');
    expect(CURRENCY_SYMBOLS.MXN).toBe('$');
    expect(CURRENCY_SYMBOLS.KRW).toBe('₩');
    expect(CURRENCY_SYMBOLS.THB).toBe('฿');
    expect(CURRENCY_SYMBOLS.TRY).toBe('₺');
    expect(CURRENCY_SYMBOLS.RUB).toBe('₽');
  });
});

describe('DISPLAY_CURRENCIES', () => {
  it('contains common display currencies', () => {
    expect(DISPLAY_CURRENCIES).toContain('USD');
    expect(DISPLAY_CURRENCIES).toContain('EUR');
    expect(DISPLAY_CURRENCIES).toContain('GBP');
    expect(DISPLAY_CURRENCIES).toContain('INR');
    expect(DISPLAY_CURRENCIES).toContain('JPY');
    expect(DISPLAY_CURRENCIES).toContain('AUD');
    expect(DISPLAY_CURRENCIES).toContain('CAD');
  });

  it('has exactly 7 display currencies', () => {
    expect(DISPLAY_CURRENCIES).toHaveLength(7);
  });
});

describe('getCurrencySymbol', () => {
  it('returns correct symbol for known currencies', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('JPY')).toBe('¥');
    expect(getCurrencySymbol('INR')).toBe('₹');
  });

  it('handles lowercase currency codes', () => {
    expect(getCurrencySymbol('usd')).toBe('$');
    expect(getCurrencySymbol('eur')).toBe('€');
    expect(getCurrencySymbol('gbp')).toBe('£');
  });

  it('handles mixed case currency codes', () => {
    expect(getCurrencySymbol('Usd')).toBe('$');
    expect(getCurrencySymbol('eUr')).toBe('€');
  });

  it('returns currency code for unknown currencies', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    expect(getCurrencySymbol('UNKNOWN')).toBe('UNKNOWN');
  });
});

describe('formatPrice', () => {
  describe('basic formatting', () => {
    it('formats USD correctly', () => {
      expect(formatPrice(100, 'USD')).toBe('$100');
      expect(formatPrice(99.99, 'USD')).toBe('$99.99');
      expect(formatPrice(1000, 'USD')).toBe('$1,000');
      expect(formatPrice(1234567.89, 'USD')).toBe('$1,234,567.89');
    });

    it('formats EUR correctly', () => {
      expect(formatPrice(100, 'EUR')).toBe('€100');
      expect(formatPrice(99.99, 'EUR')).toBe('€99.99');
    });

    it('formats GBP correctly', () => {
      expect(formatPrice(100, 'GBP')).toBe('£100');
      expect(formatPrice(99.99, 'GBP')).toBe('£99.99');
    });

    it('formats INR correctly', () => {
      expect(formatPrice(1000, 'INR')).toBe('₹1,000');
      expect(formatPrice(99.50, 'INR')).toBe('₹99.5');
    });
  });

  describe('zero decimal currencies', () => {
    it('formats JPY without decimals', () => {
      expect(formatPrice(1000, 'JPY')).toBe('¥1,000');
      expect(formatPrice(1234.56, 'JPY')).toBe('¥1,235'); // Should round
    });

    it('formats KRW without decimals', () => {
      expect(formatPrice(10000, 'KRW')).toBe('₩10,000');
      expect(formatPrice(12345.67, 'KRW')).toBe('₩12,346'); // Should round
    });
  });

  describe('default currency', () => {
    it('defaults to USD when no currency provided', () => {
      expect(formatPrice(100)).toBe('$100');
      expect(formatPrice(99.99)).toBe('$99.99');
    });
  });

  describe('approximate indicator', () => {
    it('adds ~ prefix when showApproximate is true', () => {
      expect(formatPrice(100, 'USD', { showApproximate: true })).toBe('~$100');
      expect(formatPrice(99.99, 'EUR', { showApproximate: true })).toBe('~€99.99');
    });

    it('does not add ~ prefix when showApproximate is false', () => {
      expect(formatPrice(100, 'USD', { showApproximate: false })).toBe('$100');
    });
  });

  describe('unknown currency', () => {
    it('uses currency code as symbol for unknown currencies', () => {
      expect(formatPrice(100, 'XYZ')).toBe('XYZ100');
      expect(formatPrice(99.99, 'UNKNOWN')).toBe('UNKNOWN99.99');
    });
  });

  describe('edge cases', () => {
    it('handles zero', () => {
      expect(formatPrice(0, 'USD')).toBe('$0');
    });

    it('handles negative numbers', () => {
      // Note: formatPrice puts symbol before the formatted number,
      // so negative sign appears after the symbol
      expect(formatPrice(-100, 'USD')).toBe('$-100');
    });

    it('handles very small numbers', () => {
      expect(formatPrice(0.01, 'USD')).toBe('$0.01');
      expect(formatPrice(0.001, 'USD')).toBe('$0');
    });

    it('handles very large numbers', () => {
      expect(formatPrice(999999999, 'USD')).toBe('$999,999,999');
    });
  });
});

describe('convertCurrency', () => {
  const mockRates = {
    base: 'USD',
    date: '2024-01-15',
    rates: {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      INR: 83.12,
      JPY: 148.5,
    },
  };

  describe('same currency conversion', () => {
    it('returns the same amount when currencies match', () => {
      expect(convertCurrency(100, 'USD', 'USD', mockRates)).toBe(100);
      expect(convertCurrency(50.5, 'EUR', 'EUR', mockRates)).toBe(50.5);
    });
  });

  describe('USD to other currencies', () => {
    it('converts USD to EUR', () => {
      const result = convertCurrency(100, 'USD', 'EUR', mockRates);
      expect(result).toBeCloseTo(92, 1);
    });

    it('converts USD to GBP', () => {
      const result = convertCurrency(100, 'USD', 'GBP', mockRates);
      expect(result).toBeCloseTo(79, 1);
    });

    it('converts USD to JPY', () => {
      const result = convertCurrency(100, 'USD', 'JPY', mockRates);
      expect(result).toBeCloseTo(14850, 0);
    });

    it('converts USD to INR', () => {
      const result = convertCurrency(100, 'USD', 'INR', mockRates);
      expect(result).toBeCloseTo(8312, 0);
    });
  });

  describe('other currencies to USD', () => {
    it('converts EUR to USD', () => {
      const result = convertCurrency(92, 'EUR', 'USD', mockRates);
      expect(result).toBeCloseTo(100, 0);
    });

    it('converts GBP to USD', () => {
      const result = convertCurrency(79, 'GBP', 'USD', mockRates);
      expect(result).toBeCloseTo(100, 0);
    });

    it('converts JPY to USD', () => {
      const result = convertCurrency(14850, 'JPY', 'USD', mockRates);
      expect(result).toBeCloseTo(100, 0);
    });
  });

  describe('cross-currency conversion', () => {
    it('converts EUR to GBP', () => {
      const result = convertCurrency(92, 'EUR', 'GBP', mockRates);
      // 92 EUR -> 100 USD -> 79 GBP
      expect(result).toBeCloseTo(79, 0);
    });

    it('converts GBP to JPY', () => {
      const result = convertCurrency(79, 'GBP', 'JPY', mockRates);
      // 79 GBP -> 100 USD -> 14850 JPY
      expect(result).toBeCloseTo(14850, 0);
    });

    it('converts INR to EUR', () => {
      const result = convertCurrency(8312, 'INR', 'EUR', mockRates);
      // 8312 INR -> 100 USD -> 92 EUR
      expect(result).toBeCloseTo(92, 0);
    });
  });

  describe('case insensitivity', () => {
    it('handles lowercase currency codes', () => {
      const result = convertCurrency(100, 'usd', 'eur', mockRates);
      expect(result).toBeCloseTo(92, 1);
    });

    it('handles mixed case currency codes', () => {
      const result = convertCurrency(100, 'Usd', 'Eur', mockRates);
      expect(result).toBeCloseTo(92, 1);
    });
  });

  describe('unsupported currencies', () => {
    it('returns null for unsupported source currency', () => {
      const result = convertCurrency(100, 'XYZ', 'USD', mockRates);
      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('Currency not supported: XYZ');
    });

    it('returns null for unsupported target currency', () => {
      const result = convertCurrency(100, 'USD', 'XYZ', mockRates);
      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('Currency not supported: XYZ');
    });
  });
});

describe('formatPriceWithConversion', () => {
  const mockRates = {
    base: 'USD',
    date: '2024-01-15',
    rates: {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      INR: 83.12,
      JPY: 148.5,
    },
  };

  describe('no conversion scenarios', () => {
    it('returns original price when displayCurrency is null', () => {
      const result = formatPriceWithConversion(100, 'USD', null, mockRates);
      expect(result).toEqual({
        formatted: '$100',
        isConverted: false,
      });
    });

    it('returns original price when currencies match', () => {
      const result = formatPriceWithConversion(100, 'USD', 'USD', mockRates);
      expect(result).toEqual({
        formatted: '$100',
        isConverted: false,
      });
    });

    it('returns original price when rates are null', () => {
      const result = formatPriceWithConversion(100, 'USD', 'EUR', null);
      expect(result).toEqual({
        formatted: '$100',
        isConverted: false,
      });
    });
  });

  describe('successful conversion', () => {
    it('converts USD to EUR', () => {
      const result = formatPriceWithConversion(100, 'USD', 'EUR', mockRates);
      expect(result.isConverted).toBe(true);
      expect(result.formatted).toMatch(/€9[12]/); // Should be around €92
    });

    it('converts USD to JPY', () => {
      const result = formatPriceWithConversion(100, 'USD', 'JPY', mockRates);
      expect(result.isConverted).toBe(true);
      expect(result.formatted).toContain('¥');
      expect(result.formatted).toMatch(/¥14,8[0-9]{2}/); // Should be around ¥14,850
    });

    it('converts EUR to GBP', () => {
      const result = formatPriceWithConversion(100, 'EUR', 'GBP', mockRates);
      expect(result.isConverted).toBe(true);
      expect(result.formatted).toContain('£');
    });
  });

  describe('failed conversion', () => {
    it('returns original when source currency is unsupported', () => {
      const result = formatPriceWithConversion(100, 'XYZ', 'USD', mockRates);
      expect(result).toEqual({
        formatted: 'XYZ100',
        isConverted: false,
      });
    });

    it('returns original when target currency is unsupported', () => {
      const result = formatPriceWithConversion(100, 'USD', 'XYZ', mockRates);
      expect(result).toEqual({
        formatted: '$100',
        isConverted: false,
      });
    });
  });

  describe('default currency', () => {
    it('defaults to USD when originalCurrency is not provided', () => {
      const result = formatPriceWithConversion(100, undefined as unknown as string, 'EUR', mockRates);
      expect(result.isConverted).toBe(true);
      expect(result.formatted).toMatch(/€/);
    });
  });

  describe('case insensitivity', () => {
    it('handles lowercase currency codes', () => {
      const result = formatPriceWithConversion(100, 'usd', 'eur', mockRates);
      expect(result.isConverted).toBe(true);
    });
  });
});

describe('fetchExchangeRates', () => {
  const mockApiResponse = {
    base: 'USD',
    date: '2024-01-15',
    rates: {
      EUR: 0.92,
      GBP: 0.79,
    },
  };

  beforeEach(() => {
    mockFetch.mockReset();
    localStorageMock.clear();
  });

  describe('API fetch', () => {
    it('fetches rates from API when cache is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const result = await fetchExchangeRates();

      expect(mockFetch).toHaveBeenCalledWith('https://api.frankfurter.dev/v1/latest?base=USD');
      expect(result).toEqual({
        ...mockApiResponse,
        rates: {
          ...mockApiResponse.rates,
          USD: 1, // USD should be added to rates
        },
      });
    });

    it('adds USD rate of 1 to fetched rates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const result = await fetchExchangeRates();
      expect(result?.rates.USD).toBe(1);
    });

    it('caches rates after fetching', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      await fetchExchangeRates();

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const cachedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(cachedData.base).toBe('USD');
      expect(cachedData.fetchedAt).toBeDefined();
    });
  });

  describe('cache behavior', () => {
    it('returns cached rates when cache is valid', async () => {
      const cachedRates = {
        ...mockApiResponse,
        rates: { ...mockApiResponse.rates, USD: 1 },
        fetchedAt: Date.now(), // Fresh cache
      };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedRates));

      const result = await fetchExchangeRates();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual(cachedRates);
    });

    it('fetches new rates when cache is expired', async () => {
      const expiredCache = {
        ...mockApiResponse,
        rates: { ...mockApiResponse.rates, USD: 1 },
        fetchedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(expiredCache));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const result = await fetchExchangeRates();

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('handles invalid cached data gracefully', async () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid json');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const result = await fetchExchangeRates();

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('returns null when API request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchExchangeRates();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('returns null when API returns non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await fetchExchangeRates();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
