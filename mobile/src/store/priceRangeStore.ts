import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import type { PriceRangeShape } from '../utils/affordability';

/**
 * User-defined price range — the budget bracket they want every product
 * priced against. Stored on the profile so the affordability scale
 * ($/$$/$$$) on cards is consistent across surfaces.
 */
export interface PriceRangeState {
  min: number | null;
  max: number | null;
  /** ISO 4217 (GBP, USD, EUR, INR…). Defaults to GBP at first load; user
   *  picks once. We compare currency-strict — see computeAffordability. */
  currency: string;
  setRange: (min: number, max: number, currency: string) => void;
  clearRange: () => void;
  isConfigured: () => boolean;
}

function sanitiseBound(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, value);
}

export const usePriceRangeStore = create<PriceRangeState>()(
  persist(
    (set, get) => ({
      min: null,
      max: null,
      currency: 'GBP',
      setRange: (min, max, currency) => {
        const a = sanitiseBound(min);
        const b = sanitiseBound(max);
        // Reject NaN/Infinity inputs entirely — keep prior range.
        if (a === null || b === null) return;
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        set({ min: lo, max: hi, currency: currency || 'GBP' });
      },
      clearRange: () => set({ min: null, max: null }),
      isConfigured: () => {
        const s = get();
        return s.min !== null && s.max !== null;
      },
    }),
    {
      name: 'price-range-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ min: s.min, max: s.max, currency: s.currency }),
    }
  )
);

/**
 * Memoised range hook. The {min, max, currency} object would be a new
 * reference every render if we did `usePriceRangeStore((s) => ({...}))`,
 * which Zustand's default Object.is comparator would treat as a change
 * — and trigger an infinite render loop the moment a parent re-renders
 * for any other reason. Pulling primitives + memoising fixes that.
 */
export function usePriceRange(): PriceRangeShape {
  const min = usePriceRangeStore((s) => s.min);
  const max = usePriceRangeStore((s) => s.max);
  const currency = usePriceRangeStore((s) => s.currency);
  return useMemo(() => ({ min, max, currency }), [min, max, currency]);
}
