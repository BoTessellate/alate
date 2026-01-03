'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Loader2, Plus, Check } from 'lucide-react';
import { useProductSearch } from '@/hooks/useProductSearch';
import { Input } from '@/components/ui';
import type { Product } from '@/types';

/**
 * Search Panel Content - compact search for bubble/panel
 * Results display inline, no navigation away
 * On Canvas: click to add products to canvas
 */
export default function SearchPanelContent() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  // Detect if we're on a canvas/look editor page
  const isCanvasPage = pathname.startsWith('/looks/') && pathname !== '/looks';

  // Use product search hook - smaller limit for compact view
  const { products: searchResults, isSearching } = useProductSearch(searchQuery, {
    debounceMs: 300,
    limit: 12,
  });

  // Add single product to canvas
  const addToCanvas = useCallback((product: Product) => {
    if (isCanvasPage) {
      window.dispatchEvent(
        new CustomEvent('addProductsToCanvas', {
          detail: { products: [product] },
        })
      );
      setAddedProducts((prev) => new Set(prev).add(product.id));
    }
  }, [isCanvasPage]);

  // Handle clicking a product result
  const handleProductClick = (product: Product) => {
    addToCanvas(product);
  };

  // Handle search submit - prevent default, just trigger search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Results show inline - no navigation
  };

  // Reset added products when search changes
  useEffect(() => {
    setAddedProducts(new Set());
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Compact Search Input */}
      <div className="px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <form onSubmit={handleSearchSubmit}>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--foreground-muted)' }}
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="pl-8 h-8 text-sm"
              style={{ fontSize: '13px' }}
              autoFocus
            />
          </div>
        </form>
      </div>

      {/* Results - Compact List */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading State */}
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        )}

        {/* Empty State */}
        {!isSearching && !searchQuery && (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
              style={{ backgroundColor: 'var(--surface-light)' }}
            >
              <Search size={18} style={{ color: 'var(--foreground-muted)' }} />
            </div>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Search products
            </p>
          </div>
        )}

        {/* No Results */}
        {!isSearching && searchQuery && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              No results for "{searchQuery}"
            </p>
          </div>
        )}

        {/* Results List - Compact rows */}
        {!isSearching && searchResults.length > 0 && (
          <div className="py-1">
            {searchResults.map((product) => {
              const isAdded = addedProducts.has(product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  disabled={isAdded}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-light)]"
                  style={{
                    opacity: isAdded ? 0.6 : 1,
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    className="w-10 h-10 rounded flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: 'var(--background)' }}
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Search size={14} style={{ color: 'var(--foreground-muted)' }} />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {product.product_name.replace(/^TEST_/i, '').replace(/_/g, ' ')}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: 'var(--foreground-muted)', fontSize: '11px' }}
                    >
                      {product.brand.replace(/^TEST_/i, '').replace(/_/g, ' ')}
                    </p>
                  </div>

                  {/* Add/Added indicator */}
                  <div className="flex-shrink-0">
                    {isAdded ? (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--success)' }}
                      >
                        <Check size={12} color="white" />
                      </div>
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center border"
                        style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
                      >
                        <Plus size={12} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
