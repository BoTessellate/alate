'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Loader2, X, ShoppingBag } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import VirtualizedProductGrid from '@/components/VirtualizedProductGrid';
import { useProducts } from '@/hooks/useProductSearch';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Divider,
} from '@/components/ui';

export default function DiscoverPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [showFloatingSearch, setShowFloatingSearch] = useState(false);
  const floatingInputRef = useRef<HTMLInputElement>(null);

  // Use SWR-based products hook with automatic caching
  const { products, isLoading: loading, error, mutate } = useProducts(urlQuery, 100);

  // Sync search input with URL query
  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  // Focus input when floating search opens
  useEffect(() => {
    if (showFloatingSearch && floatingInputRef.current) {
      floatingInputRef.current.focus();
    }
  }, [showFloatingSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/discover?q=${encodeURIComponent(searchQuery)}`);
    } else {
      router.push('/discover');
    }
    setShowFloatingSearch(false);
  };

  return (
    <div style={{ backgroundColor: 'var(--background)' }}>
      {/* Hero Section */}
      <div className="px-8 py-16 max-w-7xl mx-auto text-center">
        <p
          className="text-sm tracking-[0.3em] uppercase mb-4"
          style={{
            color: 'var(--foreground-muted)',
            letterSpacing: '0.3em',
          }}
        >
          Explore & Inspire
        </p>

        <h1
          className="text-6xl md:text-7xl lg:text-8xl italic mb-4"
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            color: 'var(--foreground)',
            lineHeight: 1,
          }}
        >
          Discover
        </h1>

        <p
          className="text-lg md:text-xl max-w-lg mx-auto"
          style={{
            fontFamily: 'var(--font-cormorant)',
            color: 'var(--foreground-secondary)',
            fontWeight: 300,
            letterSpacing: '0.05em',
          }}
        >
          Find products that speak to your style
        </p>
      </div>

      {/* Content */}
      <div className="px-8 pb-8 max-w-7xl mx-auto">
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
          <Card className="p-6 text-center" style={{ backgroundColor: 'var(--error)' }}>
            <p className="font-medium text-white">Error loading products</p>
            <p className="text-sm text-white/80 mt-1">
              {String(error) || 'Something went wrong'}
            </p>
            <Button
              variant="ghost"
              onClick={() => mutate()}
              className="mt-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            >
              Try Again
            </Button>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <EmptyState
            icon={ShoppingBag}
            title="No products found"
            description="Try a different search term or browse all products."
          />
        )}

        {/* Products Grid */}
        {!loading && !error && products.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                {products.length} products found
              </p>
            </div>

            {products.length > 20 ? (
              <VirtualizedProductGrid products={products} gap={24} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Search FAB */}
      <IconButton
        icon={Search}
        aria-label="Search products"
        onClick={() => setShowFloatingSearch(true)}
        className="fixed z-50 w-14 h-14 shadow-lg transition-all duration-200 cursor-pointer hover:scale-105"
        style={{
          bottom: '96px',
          right: '24px',
          backgroundColor: 'var(--primary)',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)',
          opacity: showFloatingSearch ? 0 : 1,
          pointerEvents: showFloatingSearch ? 'none' : 'auto',
        }}
        title="Search Products"
      />

      {/* Expanded Floating Search Modal */}
      {showFloatingSearch && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowFloatingSearch(false)}
          />

          {/* Search Panel */}
          <Card
            className="fixed z-50 left-4 right-4 md:left-auto md:right-6 md:w-[500px] rounded-2xl shadow-2xl"
            style={{ bottom: '100px' }}
            hoverHighlight={false}
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
                  className="flex-1 bg-transparent outline-none focus:outline-none focus-visible:outline-none text-base"
                  style={{ color: 'var(--foreground)' }}
                />
                <IconButton
                  icon={X}
                  aria-label="Close search"
                  onClick={() => setShowFloatingSearch(false)}
                />
              </div>
              <Divider spacing="sm" />
              <div className="flex justify-end">
                <Button type="submit" variant="primary">
                  Search
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
