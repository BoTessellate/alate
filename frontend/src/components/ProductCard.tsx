'use client';

import { useState, useRef, memo } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Heart, Bookmark, Shirt } from 'lucide-react';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { usePriceTier } from '@/hooks/useCurrency';
import { Card, IconButton, PlaceholderImage, generatePlaceholderStarsSVG } from '@/components/ui';
import type { Product } from '@/types';

// Lazy load modals - they're only needed when user clicks
const SaveToCollectionModal = dynamic(() => import('./SaveToCollectionModal'), {
  loading: () => null,
});
const VirtualTryOnModal = dynamic(() => import('./VirtualTryOnModal'), {
  loading: () => null,
});

interface ProductCardProps {
  product: Product;
}

// Normalize text: remove underscores, handle TEST_ prefix, title case
const normalizeText = (text: string): string => {
  if (!text) return '';
  let normalized = text.replace(/^TEST_/i, '');
  normalized = normalized.replace(/_/g, ' ');
  return normalized
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Check if URL is valid for next/image (must be http/https URL, not local file path)
const isValidImageUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  // Reject local file paths (Windows or Unix style)
  if (url.startsWith('C:') || url.startsWith('/Users/') || url.startsWith('/home/')) return false;
  // Must be http or https URL
  return url.startsWith('http://') || url.startsWith('https://');
};

function ProductCard({ product }: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const isProductInAnyCollection = useCollectionsStore(state => state.isProductInAnyCollection);
  const { getPriceTierInfo } = usePriceTier();

  const collectionsContainingProduct = isProductInAnyCollection(product.id);
  const priceTierInfo = getPriceTierInfo(product.price, product.currency);
  const isInCollection = collectionsContainingProduct.length > 0;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSaveModal(true);
  };

  const handleTryOnClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTryOnModal(true);
  };

  return (
    <>
      <Card variant="interactive" className="group h-full">
        {/* Product Image */}
        <div
          className="relative w-full h-full"
          style={{ backgroundColor: 'var(--background-secondary)' }}
        >
          {isValidImageUrl(product.image_url) ? (
            <Image
              src={product.image_url}
              alt={product.product_name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              placeholder="blur"
              blurDataURL={generatePlaceholderStarsSVG(20, 20)}
            />
          ) : (
            <PlaceholderImage className="w-full h-full" />
          )}

          {/* Product Info Overlay - Bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-medium uppercase tracking-wide mb-0.5"
                  style={{ color: 'var(--primary-light)' }}
                >
                  {normalizeText(product.brand)}
                </p>
                <h3 className="font-medium text-sm text-white line-clamp-2">
                  {normalizeText(product.product_name)}
                </h3>
              </div>
              {/* Price Tier Indicator */}
              <div
                className="flex-shrink-0 px-2 py-1 rounded-full text-sm font-bold"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'var(--primary-light)',
                }}
                title={`Price tier: ${priceTierInfo.symbol}`}
              >
                {priceTierInfo.symbol}
              </div>
            </div>
          </div>

          {/* Action Buttons - Top Right */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Favorite Button */}
            <IconButton
              icon={() => (
                <Heart
                  size={18}
                  fill={isFavorite ? 'white' : 'none'}
                  style={{ color: 'white' }}
                  aria-hidden="true"
                />
              )}
              onClick={handleFavoriteClick}
              className="w-11 h-11"
              style={{ backgroundColor: isFavorite ? 'var(--error)' : 'rgba(0,0,0,0.5)', color: 'white' }}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
            />

            {/* Save to Collection Button */}
            <IconButton
              ref={saveButtonRef}
              icon={() => (
                <Bookmark
                  size={18}
                  fill={isInCollection ? 'white' : 'none'}
                  style={{ color: 'white' }}
                  aria-hidden="true"
                />
              )}
              onClick={handleSaveClick}
              className="w-11 h-11"
              style={{ backgroundColor: isInCollection ? 'var(--primary)' : 'rgba(0,0,0,0.5)', color: 'white' }}
              aria-label={isInCollection ? 'Manage collections' : 'Save to collection'}
            />

            {/* Virtual Try-On Button */}
            <IconButton
              icon={() => (
                <Shirt size={18} style={{ color: 'white' }} aria-hidden="true" />
              )}
              onClick={handleTryOnClick}
              className="w-11 h-11"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
              aria-label="Virtual try-on"
            />
          </div>
        </div>
      </Card>

      {/* Save to Collection Modal */}
      <SaveToCollectionModal
        product={product}
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        anchorRef={saveButtonRef}
      />

      {/* Virtual Try-On Modal */}
      <VirtualTryOnModal
        product={product}
        isOpen={showTryOnModal}
        onClose={() => setShowTryOnModal(false)}
      />
    </>
  );
}

// Memoize to prevent unnecessary re-renders in grids
export default memo(ProductCard);
