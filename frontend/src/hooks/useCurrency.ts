'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  fetchExchangeRates,
  formatPriceWithConversion,
  formatPrice as formatPriceSimple,
  type DisplayCurrency,
} from '@/utils/currency';

interface ExchangeRates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

/**
 * Hook for currency conversion and formatting
 * Automatically fetches rates and respects user's currency preferences
 */
export function useCurrency() {
  const { currencyDisplayMode, localCurrency } = useSettingsStore();
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch exchange rates on mount
  useEffect(() => {
    let mounted = true;

    const loadRates = async () => {
      try {
        setIsLoading(true);
        const fetchedRates = await fetchExchangeRates();
        if (mounted) {
          setRates(fetchedRates);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to load exchange rates');
          console.error('Failed to fetch exchange rates:', err);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadRates();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Format a price with optional conversion based on user settings
   * @param price - The price amount
   * @param originalCurrency - The original currency of the price (from DB)
   * @returns Formatted price string and conversion status
   */
  const formatPrice = useCallback(
    (
      price: number,
      originalCurrency?: string
    ): { formatted: string; isConverted: boolean; originalFormatted?: string } => {
      // Default to USD if no currency provided
      const currency = originalCurrency || 'USD';

      // If mode is 'original', just show the original price
      if (currencyDisplayMode === 'original') {
        return {
          formatted: formatPriceSimple(price, currency),
          isConverted: false,
        };
      }

      // Mode is 'local', try to convert
      const result = formatPriceWithConversion(
        price,
        currency,
        localCurrency,
        rates
      );

      // If converted, also provide the original formatted price for reference
      if (result.isConverted) {
        return {
          ...result,
          originalFormatted: formatPriceSimple(price, currency),
        };
      }

      return result;
    },
    [currencyDisplayMode, localCurrency, rates]
  );

  /**
   * Simple format without conversion (always shows original)
   */
  const formatOriginal = useCallback(
    (price: number, currency: string = 'USD'): string => {
      return formatPriceSimple(price, currency);
    },
    []
  );

  return {
    formatPrice,
    formatOriginal,
    rates,
    isLoading,
    error,
    currencyDisplayMode,
    localCurrency,
    // Expose the rates date for UI display
    ratesDate: rates?.date || null,
  };
}

/**
 * Simplified hook for components that just need to format a single price
 * Returns a formatting function that handles all the logic
 */
export function usePriceFormatter() {
  const { formatPrice, isLoading } = useCurrency();

  return {
    format: (price: number, currency?: string) => formatPrice(price, currency || 'USD').formatted,
    formatWithInfo: formatPrice,
    isLoading,
  };
}

/**
 * Price tier type (1 = $, 2 = $$, 3 = $$$)
 */
export type PriceTier = 1 | 2 | 3;

/**
 * Hook for calculating price tier based on user's price range settings
 * Returns $ (tier 1), $$ (tier 2), or $$$ (tier 3) based on where
 * the price falls within the user's configured min/max range
 *
 * - Tier 1 ($):   price <= 1/3 of max
 * - Tier 2 ($$):  price > 1/3 and <= 2/3 of max
 * - Tier 3 ($$$): price > 2/3 of max
 */
export function usePriceTier() {
  const { priceRange, localCurrency } = useSettingsStore();
  const { rates } = useCurrency();

  /**
   * Calculate the price tier for a given price
   * @param price - The price amount
   * @param originalCurrency - The currency of the price
   * @returns Price tier (1, 2, or 3)
   */
  const getPriceTier = useCallback(
    (price: number, originalCurrency?: string): PriceTier => {
      const currency = originalCurrency || 'USD';

      // Convert price to the user's local currency for comparison
      let normalizedPrice = price;

      if (currency !== localCurrency && rates?.rates) {
        // Convert from original currency to USD first (base)
        const fromRate = rates.rates[currency] || 1;
        const priceInUSD = price / fromRate;

        // Then convert to user's local currency
        const toRate = rates.rates[localCurrency] || 1;
        normalizedPrice = priceInUSD * toRate;
      }

      // Calculate thresholds (1/3 and 2/3 of max)
      const oneThird = priceRange.max / 3;
      const twoThirds = (priceRange.max * 2) / 3;

      // Determine tier
      if (normalizedPrice <= oneThird) {
        return 1;
      } else if (normalizedPrice <= twoThirds) {
        return 2;
      } else {
        return 3;
      }
    },
    [priceRange, localCurrency, rates]
  );

  /**
   * Get the dollar sign string for a price tier
   */
  const getTierSymbol = useCallback((tier: PriceTier): string => {
    return '$'.repeat(tier);
  }, []);

  /**
   * Get both tier and symbol for a price
   */
  const getPriceTierInfo = useCallback(
    (price: number, originalCurrency?: string): { tier: PriceTier; symbol: string } => {
      const tier = getPriceTier(price, originalCurrency);
      return { tier, symbol: getTierSymbol(tier) };
    },
    [getPriceTier, getTierSymbol]
  );

  return {
    getPriceTier,
    getTierSymbol,
    getPriceTierInfo,
    priceRange,
    localCurrency,
  };
}
