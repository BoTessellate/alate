'use client';

import { memo } from 'react';
import Image from 'next/image';
import { Product } from '@/types';

interface MiniMoodboardItemProps {
  product: Product;
  size: 'hero' | 'small';
  isComplementary?: boolean;
  className?: string;
}

/**
 * Individual product item in the mini moodboard grid
 */
function MiniMoodboardItemComponent({
  product,
  size,
  isComplementary = false,
  className = '',
}: MiniMoodboardItemProps) {
  return (
    <div
      className={`
        relative overflow-hidden cursor-pointer group
        rounded-lg bg-gray-100
        transition-all duration-200 ease-out
        hover:shadow-lg hover:-translate-y-0.5
        ${size === 'hero' ? 'col-span-2 row-span-2' : ''}
        ${className}
      `}
    >
      {/* Product Image */}
      {product.image_url ? (
        <Image
          src={product.image_url}
          alt={product.product_name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes={size === 'hero' ? '300px' : '150px'}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <span className="text-gray-400 text-xs">No image</span>
        </div>
      )}

      {/* Hover Overlay */}
      <div
        className="
          absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
        "
      >
        <div className="absolute bottom-0 left-0 right-0 p-2">
          {product.brand && (
            <p className="text-white text-xs font-medium truncate">
              {product.brand}
            </p>
          )}
          <p className="text-white/80 text-xs truncate">
            {product.product_name}
          </p>
        </div>
      </div>

      {/* Complementary Badge */}
      {isComplementary && (
        <div
          className="
            absolute top-2 left-2
            px-2 py-0.5
            rounded-full
            bg-white/90 backdrop-blur-sm
            text-xs font-medium
            text-gray-700
            shadow-sm
          "
        >
          Pairs with
        </div>
      )}

      {/* Price Tag (for hero items) */}
      {size === 'hero' && product.price && (
        <div
          className="
            absolute top-2 right-2
            px-2 py-1
            rounded-md
            bg-white/90 backdrop-blur-sm
            text-xs font-medium
            text-gray-800
            shadow-sm
          "
        >
          {product.currency || '$'}{product.price.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export const MiniMoodboardItem = memo(MiniMoodboardItemComponent);
