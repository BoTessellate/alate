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
 * Uses the main content scroll container for virtualization
 */
export default function VirtualizedProductGrid({
  products,
  gap = 24,
}: VirtualizedProductGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [columns, setColumns] = useState(4);
  const [containerWidth, setContainerWidth] = useState(0);

  // Find the main scroll container on mount
  useEffect(() => {
    const mainElement = document.getElementById('main-content');
    if (mainElement) {
      setScrollElement(mainElement);
    }
  }, []);

  // Calculate columns based on container width
  useEffect(() => {
    const updateColumns = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;

      // Skip if width is 0 (element not visible)
      if (width === 0) return;

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

    // Use ResizeObserver with debounce to handle panel transitions smoothly
    let resizeTimeout: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize events during panel transitions
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateColumns, 50);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, []);

  // Calculate row count
  const rowCount = Math.ceil(products.length / columns);

  // Calculate item dimensions
  const itemWidth = containerWidth > 0
    ? (containerWidth - gap * (columns - 1)) / columns
    : 200;
  // Square aspect ratio for image-only cards
  const itemHeight = itemWidth;
  const rowHeight = itemHeight + gap;

  // Calculate scroll margin (distance from scroll container top to grid)
  const scrollMargin = containerRef.current?.offsetTop ?? 0;

  // Use virtualizer with main scroll container
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin,
  });

  // Force virtualizer to remeasure when dimensions change
  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer, containerWidth, columns, rowHeight, scrollElement]);

  // Don't render virtualizer until we have container dimensions and scroll element
  if (containerWidth === 0 || !scrollElement) {
    return (
      <div ref={containerRef} className="w-full min-h-[200px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.slice(0, 8).map((product) => (
            <div key={product.id} className="aspect-square">
              <MemoizedProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      {/* Key forces remount when columns change to clear stale DOM */}
      <div
        key={`grid-${columns}-${containerWidth}`}
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
              key={`row-${virtualRow.index}-${columns}-${containerWidth}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${itemHeight}px`,
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: `${gap}px`,
              }}
            >
              {rowProducts.map((product) => (
                <div key={product.id} className="h-full">
                  <MemoizedProductCard product={product} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
