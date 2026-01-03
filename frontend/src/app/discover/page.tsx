'use client';

import { useSearchParams } from 'next/navigation';
import { Loader2, ShoppingBag } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import VirtualizedProductGrid from '@/components/VirtualizedProductGrid';
import { useProducts } from '@/hooks/useProductSearch';
import {
  Button,
  Card,
  EmptyState,
} from '@/components/ui';

export default function DiscoverPage() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') || '';

  // Use SWR-based products hook with automatic caching
  const { products, isLoading: loading, error, mutate } = useProducts(urlQuery, 100);

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
      <div className="px-8 pb-24 max-w-7xl mx-auto">
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
                {urlQuery && (
                  <span style={{ color: 'var(--foreground-muted)' }}>
                    {' '}for "{urlQuery}"
                  </span>
                )}
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
    </div>
  );
}
