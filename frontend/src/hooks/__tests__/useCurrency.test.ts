/**
 * useCurrency Hook Tests
 * Tests for currency conversion and formatting React hooks
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useCurrency, usePriceFormatter } from '../useCurrency';

// Mock the settings store
const mockSettingsStore = {
  currencyDisplayMode: 'local' as 'original' | 'local',
  localCurrency: 'USD' as string,
};

jest.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: () => mockSettingsStore,
}));

// Mock the currency utils
const mockFetchExchangeRates = jest.fn();
const mockFormatPriceWithConversion = jest.fn();
const mockFormatPrice = jest.fn();

jest.mock('@/utils/currency', () => ({
  fetchExchangeRates: () => mockFetchExchangeRates(),
  formatPriceWithConversion: (...args: unknown[]) => mockFormatPriceWithConversion(...args),
  formatPrice: (...args: unknown[]) => mockFormatPrice(...args),
}));

// Mock rates for testing
const mockRates = {
  base: 'USD',
  date: '2024-01-15',
  rates: {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 148.5,
    INR: 83.12,
  },
};

describe('useCurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsStore.currencyDisplayMode = 'local';
    mockSettingsStore.localCurrency = 'USD';
    mockFetchExchangeRates.mockResolvedValue(mockRates);
    mockFormatPrice.mockImplementation((price: number, currency: string) => {
      const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
      return `${symbols[currency] || currency}${price}`;
    });
    mockFormatPriceWithConversion.mockImplementation(
      (price: number, currency: string) => ({
        formatted: `$${price}`,
        isConverted: false,
      })
    );
  });

  describe('initialization', () => {
    it('starts with loading state', () => {
      mockFetchExchangeRates.mockReturnValue(new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useCurrency());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.rates).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('fetches exchange rates on mount', async () => {
      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchExchangeRates).toHaveBeenCalledTimes(1);
    });

    it('sets rates after successful fetch', async () => {
      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.rates).toEqual(mockRates);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('error handling', () => {
    // Suppress expected console.error messages in error tests
    const originalConsoleError = console.error;
    beforeEach(() => {
      console.error = jest.fn();
    });
    afterEach(() => {
      console.error = originalConsoleError;
    });

    it('sets error state when fetch fails', async () => {
      mockFetchExchangeRates.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load exchange rates');
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('keeps rates null when fetch fails', async () => {
      mockFetchExchangeRates.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.rates).toBeNull();
    });
  });

  describe('formatPrice', () => {
    beforeEach(() => {
      mockFormatPriceWithConversion.mockImplementation(
        (price: number, from: string, to: string, rates: unknown) => {
          if (from === to || !rates) {
            return { formatted: `$${price}`, isConverted: false };
          }
          return { formatted: `€${price * 0.92}`, isConverted: true };
        }
      );
    });

    it('formats price with original mode', async () => {
      mockSettingsStore.currencyDisplayMode = 'original';
      mockFormatPrice.mockReturnValue('$100');

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const formatted = result.current.formatPrice(100, 'USD');

      expect(formatted).toEqual({
        formatted: '$100',
        isConverted: false,
      });
    });

    it('formats price with local mode and conversion', async () => {
      mockSettingsStore.currencyDisplayMode = 'local';
      mockSettingsStore.localCurrency = 'EUR';

      mockFormatPriceWithConversion.mockReturnValue({
        formatted: '€92',
        isConverted: true,
      });
      mockFormatPrice.mockReturnValue('$100');

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const formatted = result.current.formatPrice(100, 'USD');

      expect(formatted.isConverted).toBe(true);
      expect(formatted.originalFormatted).toBe('$100');
    });

    it('defaults to USD when no currency provided', async () => {
      mockFormatPriceWithConversion.mockReturnValue({
        formatted: '$100',
        isConverted: false,
      });

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.formatPrice(100);

      expect(mockFormatPriceWithConversion).toHaveBeenCalledWith(
        100,
        'USD',
        expect.any(String),
        expect.anything()
      );
    });

    it('does not include originalFormatted when not converted', async () => {
      mockSettingsStore.currencyDisplayMode = 'local';
      mockSettingsStore.localCurrency = 'USD';

      mockFormatPriceWithConversion.mockReturnValue({
        formatted: '$100',
        isConverted: false,
      });

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const formatted = result.current.formatPrice(100, 'USD');

      expect(formatted.originalFormatted).toBeUndefined();
    });
  });

  describe('formatOriginal', () => {
    it('always formats without conversion', async () => {
      mockFormatPrice.mockReturnValue('$100');

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const formatted = result.current.formatOriginal(100, 'USD');

      expect(formatted).toBe('$100');
      expect(mockFormatPrice).toHaveBeenCalledWith(100, 'USD');
    });

    it('defaults to USD currency', async () => {
      mockFormatPrice.mockReturnValue('$50');

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.formatOriginal(50);

      expect(mockFormatPrice).toHaveBeenCalledWith(50, 'USD');
    });
  });

  describe('exposed values', () => {
    it('exposes currencyDisplayMode from store', async () => {
      mockSettingsStore.currencyDisplayMode = 'original';

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currencyDisplayMode).toBe('original');
    });

    it('exposes localCurrency from store', async () => {
      mockSettingsStore.localCurrency = 'EUR';

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.localCurrency).toBe('EUR');
    });

    it('exposes ratesDate from rates', async () => {
      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.ratesDate).toBe('2024-01-15');
    });

    it('returns null ratesDate when rates are null', async () => {
      mockFetchExchangeRates.mockResolvedValue(null);

      const { result } = renderHook(() => useCurrency());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.ratesDate).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('handles unmount during fetch gracefully', async () => {
      let resolvePromise: (value: unknown) => void;
      mockFetchExchangeRates.mockReturnValue(
        new Promise(resolve => {
          resolvePromise = resolve;
        })
      );

      const { unmount } = renderHook(() => useCurrency());

      // Unmount before promise resolves
      unmount();

      // Resolve promise after unmount
      await act(async () => {
        resolvePromise!(mockRates);
      });

      // No error should be thrown
    });
  });
});

describe('usePriceFormatter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsStore.currencyDisplayMode = 'local';
    mockSettingsStore.localCurrency = 'USD';
    mockFetchExchangeRates.mockResolvedValue(mockRates);
    mockFormatPriceWithConversion.mockReturnValue({
      formatted: '$100',
      isConverted: false,
    });
    mockFormatPrice.mockImplementation((price: number) => `$${price}`);
  });

  describe('format function', () => {
    it('returns formatted price string', async () => {
      mockFormatPriceWithConversion.mockReturnValue({
        formatted: '$99.99',
        isConverted: false,
      });

      const { result } = renderHook(() => usePriceFormatter());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const formatted = result.current.format(99.99, 'USD');

      expect(formatted).toBe('$99.99');
    });

    it('defaults to USD when no currency provided', async () => {
      const { result } = renderHook(() => usePriceFormatter());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.format(100);

      // The format function should have called formatPrice internally with USD
      expect(mockFormatPriceWithConversion).toHaveBeenCalled();
    });
  });

  describe('formatWithInfo function', () => {
    it('returns full format info object', async () => {
      mockFormatPriceWithConversion.mockReturnValue({
        formatted: '€92',
        isConverted: true,
      });

      const { result } = renderHook(() => usePriceFormatter());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const info = result.current.formatWithInfo(100, 'USD');

      expect(info).toHaveProperty('formatted');
      expect(info).toHaveProperty('isConverted');
    });
  });

  describe('isLoading state', () => {
    it('exposes loading state', () => {
      mockFetchExchangeRates.mockReturnValue(new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => usePriceFormatter());

      expect(result.current.isLoading).toBe(true);
    });

    it('updates loading state when fetch completes', async () => {
      const { result } = renderHook(() => usePriceFormatter());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});

describe('hook memoization', () => {
  beforeEach(() => {
    mockFetchExchangeRates.mockResolvedValue(mockRates);
    mockFormatPriceWithConversion.mockReturnValue({
      formatted: '$100',
      isConverted: false,
    });
    mockFormatPrice.mockReturnValue('$100');
  });

  it('formatPrice function is memoized', async () => {
    const { result, rerender } = renderHook(() => useCurrency());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const formatPrice1 = result.current.formatPrice;

    rerender();

    const formatPrice2 = result.current.formatPrice;

    // Function reference should be the same due to useCallback
    expect(formatPrice1).toBe(formatPrice2);
  });

  it('formatOriginal function is memoized', async () => {
    const { result, rerender } = renderHook(() => useCurrency());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const formatOriginal1 = result.current.formatOriginal;

    rerender();

    const formatOriginal2 = result.current.formatOriginal;

    expect(formatOriginal1).toBe(formatOriginal2);
  });
});
