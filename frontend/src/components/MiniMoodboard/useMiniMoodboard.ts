'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { Product } from '@/types';
import { getMoodConfig, productMatchesMood, TimeMoodConfig } from './timeMoodMapping';

interface MiniMoodboardState {
  products: Product[];
  complementaryProducts: Product[];
  loading: boolean;
  error: string | null;
  moodConfig: TimeMoodConfig | null;
  isEmpty: boolean;
}

interface CachedMoodboard {
  period: string;
  products: Product[];
  complementary: Product[];
  fetchedAt: number;
}

const CACHE_KEY = 'tml-mini-moodboard-cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Custom hook for fetching and managing mini moodboard products
 */
export function useMiniMoodboard(timePeriod: string | undefined) {
  const { collections } = useCollectionsStore();
  const [state, setState] = useState<MiniMoodboardState>({
    products: [],
    complementaryProducts: [],
    loading: true,
    error: null,
    moodConfig: null,
    isEmpty: false,
  });

  // Get mood configuration for current time
  const moodConfig = useMemo(() => {
    return timePeriod ? getMoodConfig(timePeriod) : null;
  }, [timePeriod]);

  // Get all products from collections
  const allProducts = useMemo(() => {
    return collections.flatMap(col => col.products);
  }, [collections]);

  // Check cache
  const getCachedData = useCallback((): CachedMoodboard | null => {
    if (typeof window === 'undefined') return null;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: CachedMoodboard = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid and for the same period
      if (data.period === timePeriod && now - data.fetchedAt < CACHE_TTL) {
        return data;
      }
    } catch {
      // Invalid cache, ignore
    }
    return null;
  }, [timePeriod]);

  // Save to cache
  const setCachedData = useCallback((products: Product[], complementary: Product[]) => {
    if (typeof window === 'undefined' || !timePeriod) return;

    const data: CachedMoodboard = {
      period: timePeriod,
      products,
      complementary,
      fetchedAt: Date.now(),
    };

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable, ignore
    }
  }, [timePeriod]);

  // Filter and score products based on mood
  const selectProducts = useCallback(() => {
    if (!moodConfig || allProducts.length === 0) {
      return { main: [], complementary: [] };
    }

    // Score all products
    const scoredProducts = allProducts.map(product => ({
      product,
      score: productMatchesMood(product, moodConfig),
    }));

    // Sort by score and filter out zero-score items
    const relevantProducts = scoredProducts
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);

    // Select top 4-6 products for main display
    const mainProducts = relevantProducts.slice(0, 6).map(p => p.product);

    // Find complementary products (different from main, matching pairs_with categories)
    const mainIds = new Set(mainProducts.map(p => p.id));
    const complementary: Product[] = [];

    // Look for products that could pair with the main selection
    for (const product of allProducts) {
      if (mainIds.has(product.id)) continue;
      if (complementary.length >= 2) break;

      // Check if product's category matches pairs_with categories
      const categoryMatch = moodConfig.pairsWithCategories.some(cat =>
        product.category?.toLowerCase().includes(cat.toLowerCase()) ||
        product.tags?.some(tag => tag.toLowerCase().includes(cat.toLowerCase()))
      );

      if (categoryMatch) {
        complementary.push(product);
      }
    }

    // If no category matches, just pick products with different categories
    if (complementary.length === 0 && mainProducts.length > 0) {
      const mainCategories = new Set(mainProducts.map(p => p.category));
      for (const product of allProducts) {
        if (mainIds.has(product.id)) continue;
        if (complementary.length >= 2) break;
        if (!mainCategories.has(product.category)) {
          complementary.push(product);
        }
      }
    }

    return { main: mainProducts, complementary };
  }, [moodConfig, allProducts]);

  // Load products
  const loadProducts = useCallback(() => {
    if (!moodConfig) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    // Check cache first
    const cached = getCachedData();
    if (cached) {
      setState({
        products: cached.products,
        complementaryProducts: cached.complementary,
        loading: false,
        error: null,
        moodConfig,
        isEmpty: cached.products.length === 0,
      });
      return;
    }

    // Select products from collections
    const { main, complementary } = selectProducts();

    // Cache the result
    if (main.length > 0) {
      setCachedData(main, complementary);
    }

    setState({
      products: main,
      complementaryProducts: complementary,
      loading: false,
      error: null,
      moodConfig,
      isEmpty: main.length === 0,
    });
  }, [moodConfig, getCachedData, selectProducts, setCachedData]);

  // Refresh function - clears cache and reloads
  const refresh = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_KEY);
    }

    setState(prev => ({ ...prev, loading: true }));

    // Add slight delay for visual feedback
    setTimeout(() => {
      const { main, complementary } = selectProducts();

      // Shuffle to get different results
      const shuffled = [...main].sort(() => Math.random() - 0.5);

      if (shuffled.length > 0) {
        setCachedData(shuffled, complementary);
      }

      setState({
        products: shuffled,
        complementaryProducts: complementary,
        loading: false,
        error: null,
        moodConfig,
        isEmpty: shuffled.length === 0,
      });
    }, 300);
  }, [moodConfig, selectProducts, setCachedData]);

  // Load on mount and when period changes
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return {
    ...state,
    refresh,
  };
}
