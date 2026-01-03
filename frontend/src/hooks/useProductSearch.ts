import useSWR from 'swr';
import { useState, useEffect } from 'react';
import type { Product } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-tml.vercel.app';
console.log('[useProductSearch] API_BASE_URL:', API_BASE_URL);

interface SearchResponse {
  products: Product[];
  total?: number;
}

// Fetcher function for SWR - gracefully handles failures
const fetcher = async (url: string): Promise<SearchResponse> => {
  console.log('[useProductSearch] Fetching:', url);
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn('[useProductSearch] API returned error:', response.status);
      return { products: [], total: 0 };
    }
    const data = await response.json();
    console.log('[useProductSearch] Got', data.products?.length || 0, 'products');
    return data;
  } catch (error) {
    // Network errors - fail silently with empty results
    // AbortError is expected when requests are canceled by SWR
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[useProductSearch] Request aborted (expected during typing)');
    } else {
      console.error('[useProductSearch] API error:', error);
    }
    return { products: [], total: 0 };
  }
};

interface UseProductSearchOptions {
  debounceMs?: number;
  limit?: number;
}

/**
 * Custom hook for product search with SWR caching and debouncing
 * - Caches search results to avoid redundant API calls
 * - Debounces input to reduce API requests while typing
 * - Deduplicates concurrent requests automatically
 */
export function useProductSearch(
  query: string,
  options: UseProductSearchOptions = {}
) {
  const { debounceMs = 300, limit = 10 } = options;
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Only fetch when we have a query
  const shouldFetch = debouncedQuery.trim().length > 0;
  const searchUrl = shouldFetch
    ? `${API_BASE_URL}/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=${limit}`
    : null;

  const { data, isLoading, isValidating, mutate } = useSWR<SearchResponse>(
    searchUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache results for 1 minute
      keepPreviousData: true, // Show previous results while fetching new ones
      shouldRetryOnError: false, // We handle errors internally
    }
  );

  return {
    products: data?.products || [],
    total: data?.total,
    isSearching: isLoading || isValidating,
    error: null, // Errors handled internally - always null
    mutate,
    debouncedQuery,
  };
}

/**
 * Hook for fetching all products (Discover page)
 * Uses SWR for caching and automatic revalidation
 */
export function useProducts(query: string = '', limit: number = 50) {
  const searchUrl = `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;

  const { data, isLoading, isValidating, mutate } = useSWR<SearchResponse>(
    searchUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
      revalidateOnReconnect: true,
      shouldRetryOnError: false, // We handle errors internally
    }
  );

  return {
    products: data?.products || [],
    total: data?.total,
    isLoading,
    isValidating,
    error: null, // Errors handled internally - always null
    mutate,
  };
}
