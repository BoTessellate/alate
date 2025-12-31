'use client';

import { useRef, useEffect, useState, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import ProductCard from './ProductCard';
import type { Product } from '@/types';

interface VirtualizedProductGridProps {
  products: Product[];
  gap?: number;
}

// Memoized product card wrapper to prevent unnecessary re-renders
const MemoizedProductCard = memo(({ product }: { product: Product }) => (
  <ProductCard product={product} />
));
MemoizedProductCard.displayName = 'MemoizedProductCard';

/**
 * Virtualized product grid that only renders visible items
 * Significantly improves performance for large product lists
 */
export default function VirtualizedProductGrid({
  products,
  gap = 24,
}: VirtualizedProductGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate columns based on container width
  useEffect(() => {
    const updateColumns = () => {
      if (!parentRef.current) return;
      const width = parentRef.current.offsetWidth;
      setContainerWidth(width);

      // Match Tailwind breakpoints: sm:2, md:3, lg:4
      if (width < 640) {
        setColumns(1);
      } else if (width < 768) {
        setColumns(2);
      } else if (width < 1024) {
        setColumns(3);
      } else {
        setColumns(4);
      }
    };

    updateColumns();

    const resizeObserver = new ResizeObserver(updateColumns);
    if (parentRef.current) {
      resizeObserver.observe(parentRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate row count
  const rowCount = Math.ceil(products.length / columns);

  // Calculate item dimensions
  const itemWidth = containerWidth > 0
    ? (containerWidth - gap * (columns - 1)) / columns
    : 200;
  // Aspect ratio ~1.4 for product cards (image + info)
  const itemHeight = itemWidth * 1.4;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight + gap,
    overscan: 2, // Render 2 extra rows above/below viewport
  });

  // Don't render virtualizer until we have container dimensions
  if (containerWidth === 0) {
    return (
      <div ref={parentRef} className="w-full min-h-[200px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.slice(0, 8).map((product) => (
            <MemoizedProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="w-full overflow-auto"
      style={{
        height: '100%',
        maxHeight: 'calc(100vh - 250px)', // Account for header/nav
      }}
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
                <MemoizedProductCard key={product.id} product={product} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
