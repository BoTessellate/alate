'use client';

import { useState, useRef, memo } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Heart, Bookmark, ExternalLink, Shirt } from 'lucide-react';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { usePriceFormatter } from '@/hooks/useCurrency';
import { getProductUrl, generatePlaceholderSVG } from '@/utils/placeholder';
import { Card, IconButton } from '@/components/ui';
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
  onExternalLink?: (product: Product) => void;
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

function ProductCard({ product, onExternalLink }: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const isProductInAnyCollection = useCollectionsStore(state => state.isProductInAnyCollection);
  const { format } = usePriceFormatter();

  const collectionsContainingProduct = isProductInAnyCollection(product.id);
  const isInCollection = collectionsContainingProduct.length > 0;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSaveModal(true);
  };

  const handleExternalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExternalLink) {
      onExternalLink(product);
    } else {
      const url = getProductUrl(product.brand, product.product_name);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleTryOnClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTryOnModal(true);
  };

  return (
    <>
      <Card variant="interactive" className="group">
        {/* Product Image */}
        <div
          className="relative aspect-square"
          style={{ backgroundColor: 'var(--background-secondary)' }}
        >
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.product_name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              placeholder="blur"
              blurDataURL={generatePlaceholderSVG(product.product_name, 20, 20)}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                backgroundImage: 'linear-gradient(135deg, var(--primary) 0%, var(--cream-dark) 100%)',
                opacity: 0.5,
              }}
            />
          )}

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

        {/* Product Info */}
        <div className="p-4">
          <p
            className="text-xs font-medium uppercase tracking-wide mb-1"
            style={{ color: 'var(--primary)' }}
          >
            {normalizeText(product.brand)}
          </p>
          <h3
            className="font-medium text-sm mb-2 line-clamp-2"
            style={{ color: 'var(--foreground)' }}
          >
            {normalizeText(product.product_name)}
          </h3>
          <div className="flex items-center justify-between">
            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
              {format(product.price, product.currency)}
            </p>
            <IconButton
              icon={ExternalLink}
              aria-label={`Shop ${normalizeText(product.product_name)} on external site`}
              onClick={handleExternalClick}
              size="lg"
              className="-mr-2"
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
