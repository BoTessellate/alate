'use client';

import { useRef, useEffect, useState, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Image from 'next/image';
import { Heart, Plus } from 'lucide-react';
import { generatePlaceholderStarsSVG } from '@/components/ui';
import type { Product } from '@/types';

interface VirtualizedSidebarProductsProps {
  products: Product[];
  favorites: Set<string>;
  onAddToCanvas: (product: Product) => void;
  onToggleFavorite: (productId: string) => void;
  formatPrice: (price: number, currency?: string) => string;
  normalizeText: (text: string) => string;
  getProductImage: (imageUrl: string | null | undefined, productName: string) => string;
}

interface SidebarProductCardProps {
  product: Product;
  isFavorite: boolean;
  onAddToCanvas: () => void;
  onToggleFavorite: () => void;
  formatPrice: (price: number, currency?: string) => string;
  normalizeText: (text: string) => string;
  getProductImage: (imageUrl: string | null | undefined, productName: string) => string;
}

// Memoized product card for the sidebar
const SidebarProductCard = memo(function SidebarProductCard({
  product,
  isFavorite,
  onAddToCanvas,
  onToggleFavorite,
  formatPrice,
  normalizeText,
  getProductImage,
}: SidebarProductCardProps) {
  return (
    <div
      className="group rounded-lg border overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        backgroundColor: 'var(--surface-light)',
        borderColor: 'var(--border)',
      }}
      onClick={onAddToCanvas}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div
        className="relative aspect-square"
        style={{ backgroundColor: 'var(--background-secondary)' }}
      >
        <Image
          src={getProductImage(product.image_url, product.product_name)}
          alt={product.product_name}
          fill
          className="object-cover"
          sizes="150px"
          placeholder="blur"
          blurDataURL={generatePlaceholderStarsSVG(10, 10)}
        />

        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: 'rgba(76, 112, 49, 0.8)' }}
        >
          <Plus size={24} style={{ color: 'white' }} />
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
          style={{
            backgroundColor: isFavorite ? 'var(--error)' : 'rgba(0,0,0,0.5)',
          }}
        >
          <Heart
            size={12}
            fill={isFavorite ? 'white' : 'none'}
            style={{ color: 'white' }}
          />
        </button>
      </div>

      <div className="p-2">
        <p
          className="text-xs font-medium uppercase tracking-wide mb-0.5"
          style={{ color: 'var(--primary)' }}
        >
          {normalizeText(product.brand)}
        </p>
        <h4
          className="font-medium text-xs mb-1 line-clamp-2"
          style={{ color: 'var(--foreground)' }}
        >
          {normalizeText(product.product_name)}
        </h4>
        <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
          {formatPrice(product.price, product.currency)}
        </p>
      </div>
    </div>
  );
});

/**
 * Virtualized product grid for moodboard editor sidebar
 * Only renders visible products to improve performance with 50+ items
 */
export default function VirtualizedSidebarProducts({
  products,
  favorites,
  onAddToCanvas,
  onToggleFavorite,
  formatPrice,
  normalizeText,
  getProductImage,
}: VirtualizedSidebarProductsProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(2);
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate columns based on container width (xl breakpoint for 3 cols)
  useEffect(() => {
    const updateColumns = () => {
      if (!parentRef.current) return;
      const width = parentRef.current.offsetWidth;
      setContainerWidth(width);
      // xl: 3 columns, otherwise 2
      setColumns(width >= 400 ? 3 : 2);
    };

    updateColumns();

    const resizeObserver = new ResizeObserver(updateColumns);
    if (parentRef.current) {
      resizeObserver.observe(parentRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const rowCount = Math.ceil(products.length / columns);
  const gap = 12; // 3 in Tailwind = 12px
  const itemWidth = containerWidth > 0 ? (containerWidth - gap * (columns - 1)) / columns : 100;
  // Card height: square image + ~60px for info
  const itemHeight = itemWidth + 70;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight + gap,
    overscan: 3,
  });

  // Initial render before measurements
  if (containerWidth === 0) {
    return (
      <div ref={parentRef} className="h-full overflow-y-auto">
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {products.slice(0, 6).map((product) => (
            <SidebarProductCard
              key={product.id}
              product={product}
              isFavorite={favorites.has(product.id)}
              onAddToCanvas={() => onAddToCanvas(product)}
              onToggleFavorite={() => onToggleFavorite(product.id)}
              formatPrice={formatPrice}
              normalizeText={normalizeText}
              getProductImage={getProductImage}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-y-auto"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowProducts = products.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size - gap}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: `${gap}px`,
              }}
            >
              {rowProducts.map((product) => (
                <SidebarProductCard
                  key={product.id}
                  product={product}
                  isFavorite={favorites.has(product.id)}
                  onAddToCanvas={() => onAddToCanvas(product)}
                  onToggleFavorite={() => onToggleFavorite(product.id)}
                  formatPrice={formatPrice}
                  normalizeText={normalizeText}
                  getProductImage={getProductImage}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
