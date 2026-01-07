'use client';

import { memo } from 'react';
import Image from 'next/image';
import { Check, ExternalLink, Pencil } from 'lucide-react';
import type { ChatProduct } from '@/stores/useChatStore';

export interface ProductResultCardProps {
  product: ChatProduct;
  source: 'upload' | 'scrape' | 'search';
  onWishlistToggle?: (productId: string) => void;
  onClosetToggle?: (productId: string) => void;
  onEdit?: (product: ChatProduct) => void;
  onClick?: (productId: string) => void;
  compact?: boolean;
}

/**
 * ProductResultCard - Compact product card for inline chat display
 *
 * Shows:
 * - Thumbnail image (48x48 or 64x64)
 * - Brand, product name, and price as tag pills
 * - Product tags from enrichment
 * - Radio buttons for Closet/Wishlist (mutually exclusive)
 */
export const ProductResultCard = memo(function ProductResultCard({
  product,
  source,
  onWishlistToggle,
  onClosetToggle,
  onEdit,
  onClick,
  compact = false,
}: ProductResultCardProps) {
  const imageSize = compact ? 48 : 64;

  const handleWishlistChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWishlistToggle?.(product.id);
  };

  const handleClosetChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClosetToggle?.(product.id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(product);
  };

  const handleCardClick = () => {
    onClick?.(product.id);
  };

  // Format price
  const formatPrice = (price: number, currency?: string) => {
    if (!price || price === 0) return null;
    const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'INR' ? '₹' : '$';
    return `${currencySymbol}${price.toFixed(0)}`;
  };

  const priceDisplay = formatPrice(product.price, product.currency);

  // Get display tags (limit to 3)
  const displayTags = product.tags?.slice(0, 3) || [];

  // Only show pointer cursor if there's a click action
  const hasClickAction = !!onClick;

  return (
    <div
      className={`flex items-start gap-3 p-2 rounded-lg border transition-colors ${hasClickAction ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
      onClick={hasClickAction ? handleCardClick : undefined}
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
        {/* Brand, Name, Price as tag pills */}
        <div className="flex flex-wrap gap-1 mb-1.5">
          {product.brand && (
            <span
              className="px-2 py-0.5 text-xs rounded-full"
              style={{
                backgroundColor: 'var(--surface-light)',
                color: 'var(--foreground-secondary)',
              }}
            >
              {product.brand}
            </span>
          )}
          <span
            className="px-2 py-0.5 text-xs rounded-full font-medium truncate max-w-[150px]"
            style={{
              backgroundColor: 'var(--surface-light)',
              color: 'var(--foreground)',
            }}
            title={product.product_name}
          >
            {product.product_name}
          </span>
          {priceDisplay && (
            <span
              className="px-2 py-0.5 text-xs rounded-full font-medium"
              style={{
                backgroundColor: 'var(--primary-alpha)',
                color: 'var(--primary-dark)',
              }}
            >
              {priceDisplay}
            </span>
          )}
        </div>

        {/* Product tags from enrichment */}
        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {displayTags.map((tag, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-[10px] rounded"
                style={{
                  backgroundColor: 'var(--surface)',
                  color: 'var(--foreground-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions based on source */}
        <div className="flex items-center gap-3">
          {/* Radio buttons for URL scrapes - mutually exclusive */}
          {source === 'scrape' && (
            <>
              {/* Closet radio */}
              <label
                className="flex items-center gap-1.5 cursor-pointer"
                onClick={handleClosetChange}
              >
                <input
                  type="radio"
                  name={`product-dest-${product.id}`}
                  checked={product.isAddedToCloset || false}
                  onChange={() => {}}
                  className="w-3.5 h-3.5 cursor-pointer accent-[var(--primary)]"
                />
                <span
                  className="text-xs"
                  style={{ color: product.isAddedToCloset ? 'var(--success)' : 'var(--foreground-secondary)' }}
                >
                  Closet
                </span>
              </label>
              {/* Wishlist radio */}
              <label
                className="flex items-center gap-1.5 cursor-pointer"
                onClick={handleWishlistChange}
              >
                <input
                  type="radio"
                  name={`product-dest-${product.id}`}
                  checked={product.isWishlisted || false}
                  onChange={() => {}}
                  className="w-3.5 h-3.5 cursor-pointer accent-[var(--primary)]"
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
                onClosetToggle?.(product.id);
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

          {/* Added indicator and edit button - for uploads only */}
          {source === 'upload' && (
            <>
              <span
                className="text-xs flex items-center gap-1"
                style={{ color: 'var(--success)' }}
              >
                <Check size={12} />
                In Closet
              </span>
              {onEdit && (
                <button
                  onClick={handleEditClick}
                  className="text-xs flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                  style={{ color: 'var(--foreground-muted)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--primary)';
                    e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--foreground-muted)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Pencil size={10} />
                  Edit
                </button>
              )}
            </>
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
