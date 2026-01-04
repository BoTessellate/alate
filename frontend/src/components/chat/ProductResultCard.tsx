'use client';

import { memo } from 'react';
import Image from 'next/image';
import { Check, ExternalLink } from 'lucide-react';
import type { ChatProduct } from '@/stores/useChatStore';

export interface ProductResultCardProps {
  product: ChatProduct;
  source: 'upload' | 'scrape' | 'search';
  onWishlistToggle?: (productId: string) => void;
  onAddToCloset?: (productId: string) => void;
  onClick?: (productId: string) => void;
  compact?: boolean;
}

/**
 * ProductResultCard - Compact product card for inline chat display
 *
 * Shows:
 * - Thumbnail image (48x48 or 64x64)
 * - Product name and brand
 * - Price (if available)
 * - Wishlist checkbox (for URL scrapes)
 * - Added checkmark (for uploaded products)
 */
export const ProductResultCard = memo(function ProductResultCard({
  product,
  source,
  onWishlistToggle,
  onAddToCloset,
  onClick,
  compact = false,
}: ProductResultCardProps) {
  const imageSize = compact ? 48 : 64;

  const handleWishlistChange = () => {
    onWishlistToggle?.(product.id);
  };

  const handleAddClick = () => {
    onAddToCloset?.(product.id);
  };

  const handleCardClick = () => {
    onClick?.(product.id);
  };

  // Format price
  const formatPrice = (price: number, currency?: string) => {
    if (!price || price === 0) return null;
    const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
    return `${currencySymbol}${price.toFixed(0)}`;
  };

  const priceDisplay = formatPrice(product.price, product.currency);

  return (
    <div
      className="flex items-start gap-3 p-2 rounded-lg border transition-colors cursor-pointer"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
      onClick={handleCardClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--surface-light)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--surface)';
      }}
    >
      {/* Product image */}
      <div
        className="relative flex-shrink-0 rounded-md overflow-hidden"
        style={{
          width: imageSize,
          height: imageSize,
          backgroundColor: 'var(--surface-light)',
        }}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.product_name}
            fill
            className="object-cover"
            sizes={`${imageSize}px`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span
              className="text-xs"
              style={{ color: 'var(--foreground-muted)' }}
            >
              No image
            </span>
          </div>
        )}

        {/* Added checkmark overlay for closet items */}
        {product.isAddedToCloset && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.8)' }}
          >
            <Check size={20} color="white" />
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <h4
          className="text-sm font-medium truncate"
          style={{ color: 'var(--foreground)' }}
        >
          {product.product_name}
        </h4>
        <p
          className="text-xs truncate"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {product.brand}
          {priceDisplay && ` · ${priceDisplay}`}
        </p>

        {/* Actions based on source */}
        <div className="mt-1.5 flex items-center gap-2">
          {/* Checkbox toggles for URL scrapes - both can be selected */}
          {source === 'scrape' && (
            <>
              {/* Closet checkbox */}
              <label
                className="flex items-center gap-1.5 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={product.isAddedToCloset || false}
                  onChange={handleAddClick}
                  className="w-3.5 h-3.5 rounded border cursor-pointer accent-[var(--primary)]"
                />
                <span
                  className="text-xs"
                  style={{ color: product.isAddedToCloset ? 'var(--success)' : 'var(--foreground-secondary)' }}
                >
                  Closet
                </span>
              </label>
              {/* Wishlist checkbox - checked by default */}
              <label
                className="flex items-center gap-1.5 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={product.isWishlisted || false}
                  onChange={handleWishlistChange}
                  className="w-3.5 h-3.5 rounded border cursor-pointer accent-[var(--primary)]"
                />
                <span
                  className="text-xs"
                  style={{ color: product.isWishlisted ? 'var(--primary)' : 'var(--foreground-secondary)' }}
                >
                  Wishlist
                </span>
              </label>
            </>
          )}

          {/* Add to closet button for search results */}
          {source === 'search' && !product.isAddedToCloset && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddClick();
              }}
              className="text-xs px-2 py-0.5 rounded-full transition-colors"
              style={{
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary-dark)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                e.currentTarget.style.color = 'var(--primary-dark)';
              }}
            >
              + Add
            </button>
          )}

          {/* Added indicator - for uploads only (scrapes use checkboxes) */}
          {source === 'upload' && (
            <span
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--success)' }}
            >
              <Check size={12} />
              In Closet
            </span>
          )}

          {/* Added indicator - for search results added to closet */}
          {source === 'search' && product.isAddedToCloset && (
            <span
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--success)' }}
            >
              <Check size={12} />
              Added
            </span>
          )}
        </div>
      </div>

      {/* External link icon for URL scrapes */}
      {source === 'scrape' && (
        <ExternalLink
          size={14}
          style={{ color: 'var(--foreground-muted)' }}
          className="flex-shrink-0 mt-1"
        />
      )}
    </div>
  );
});

export default ProductResultCard;
