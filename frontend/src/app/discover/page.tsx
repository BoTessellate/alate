'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import type { Product } from '@/types';

const API_BASE_URL = 'https://backend-tml.vercel.app';

export default function DiscoverPage() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(urlQuery);

  const fetchProducts = async (query: string = '') => {
    setLoading(true);
    setError(null);
    try {
      let response;

      if (query.trim()) {
        // Use POST for search queries
        response = await fetch(`${API_BASE_URL}/api/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: query,
            limit: 100,
          }),
        });
      } else {
        // Use GET to fetch all products (no search filter)
        response = await fetch(`${API_BASE_URL}/api/search?limit=100`);
      }

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch products on mount or when URL query changes
  useEffect(() => {
    setSearchQuery(urlQuery);
    fetchProducts(urlQuery);
  }, [urlQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(searchQuery);
  };

  return (
    <div style={{ backgroundColor: 'var(--background)' }}>
      {/* Header Section - Static */}
      <div className="px-8 pt-8 pb-6 max-w-7xl mx-auto flex items-baseline gap-3">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
          Discover
        </h1>
        <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Explore products and add them to your collections
        </span>
      </div>

      {/* Floating Search Bar - Only the bar floats */}
      <div className="sticky top-3 z-30 px-8">
        <form onSubmit={handleSearch} className="max-w-7xl mx-auto">
          <div
            className="flex items-center gap-3 rounded-xl border focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/20"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              padding: '10px 16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.05)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Search size={20} style={{ color: 'var(--foreground-muted)' }} />
            <input
              type="text"
              placeholder="Search for products... (e.g., 'blue sofa', 'vintage lamp')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--foreground)' }}
            />
            <button
              type="submit"
              className="rounded-md text-sm font-medium cursor-pointer px-4 py-2 transition-colors"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'white',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
              }}
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Content area */}
      <div className="px-8 pb-8 max-w-7xl mx-auto mt-6">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: 'var(--primary)' }}
            />
            <span className="ml-3" style={{ color: 'var(--foreground-secondary)' }}>
              Loading products...
            </span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div
            className="p-6 rounded-lg text-center"
            style={{
              backgroundColor: 'var(--error)',
              color: 'white',
            }}
          >
            <p className="font-medium">Error loading products</p>
            <p className="text-sm opacity-80 mt-1">{error}</p>
            <button
              onClick={() => fetchProducts(searchQuery)}
              className="mt-4 px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <div
            className="p-12 rounded-lg text-center"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <p className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>
              No products found
            </p>
            <p style={{ color: 'var(--foreground-secondary)' }}>
              Try a different search term or browse all products.
            </p>
          </div>
        )}

        {/* Products Grid */}
        {!loading && !error && products.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                {products.length} products found
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
