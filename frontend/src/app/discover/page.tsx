'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Loader2, X } from 'lucide-react';
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
  const [showFloatingSearch, setShowFloatingSearch] = useState(false);
  const floatingInputRef = useRef<HTMLInputElement>(null);

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

  // Focus input when floating search opens
  useEffect(() => {
    if (showFloatingSearch && floatingInputRef.current) {
      floatingInputRef.current.focus();
    }
  }, [showFloatingSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(searchQuery);
    setShowFloatingSearch(false);
  };

  const handleFloatingSearchClick = () => {
    setShowFloatingSearch(true);
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

      {/* Floating Search FAB - Always visible, positioned above Plus FAB */}
      <button
        onClick={handleFloatingSearchClick}
        className="fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-200 cursor-pointer"
        style={{
          bottom: '96px', // Above the Plus FAB (which is at 24px, plus 56px height + 16px gap)
          right: '24px',
          width: '56px',
          height: '56px',
          backgroundColor: 'var(--primary)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)',
          opacity: showFloatingSearch ? 0 : 1,
          pointerEvents: showFloatingSearch ? 'none' : 'auto',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.backgroundColor = 'var(--primary-light)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'var(--primary)';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.95)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        title="Search Products"
        aria-label="Search products"
      >
        <Search size={24} color="white" />
      </button>

      {/* Expanded Floating Search Modal */}
      {showFloatingSearch && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowFloatingSearch(false)}
          />

          {/* Search Panel */}
          <div
            className="fixed z-50 left-4 right-4 md:left-auto md:right-6 md:w-[500px] rounded-2xl shadow-2xl"
            style={{
              bottom: '100px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <form onSubmit={handleSearch} className="p-4">
              <div className="flex items-center gap-3">
                <Search size={20} style={{ color: 'var(--foreground-muted)' }} />
                <input
                  ref={floatingInputRef}
                  type="text"
                  placeholder="Search for products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-base"
                  style={{ color: 'var(--foreground)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowFloatingSearch(false)}
                  className="p-2 rounded-full hover:bg-[var(--surface-light)] transition-colors"
                  aria-label="Close search"
                >
                  <X size={20} style={{ color: 'var(--foreground-muted)' }} />
                </button>
              </div>
              <div className="flex justify-end mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="submit"
                  className="rounded-lg text-sm font-medium px-6 py-2.5 transition-colors"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                  }}
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
