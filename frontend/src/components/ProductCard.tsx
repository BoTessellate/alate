'use client';

import { useState, useRef } from 'react';
import { Heart, Bookmark, ExternalLink, Shirt } from 'lucide-react';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { usePriceFormatter } from '@/hooks/useCurrency';
import { getProductUrl } from '@/utils/placeholder';
import SaveToCollectionModal from './SaveToCollectionModal';
import VirtualTryOnModal from './VirtualTryOnModal';
import type { Product } from '@/types';

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

export default function ProductCard({ product, onExternalLink }: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const { isProductInAnyCollection } = useCollectionsStore();
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
      // Open generated product URL in new tab
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
      <div
        className="group rounded-lg border overflow-hidden transition-all duration-200"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        {/* Product Image */}
        <div
          className="relative aspect-square"
          style={{ backgroundColor: 'var(--background-secondary)' }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.product_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, var(--primary) 0%, var(--cream-dark) 100%)',
                opacity: 0.5,
              }}
            />
          )}

          {/* Action Buttons - Top Right */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Favorite Button */}
            <button
              onClick={handleFavoriteClick}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
              style={{
                backgroundColor: isFavorite ? 'var(--error)' : 'rgba(0,0,0,0.5)',
              }}
            >
              <Heart
                size={16}
                fill={isFavorite ? 'white' : 'none'}
                style={{ color: 'white' }}
              />
            </button>

            {/* Save to Collection Button */}
            <button
              ref={saveButtonRef}
              onClick={handleSaveClick}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
              style={{
                backgroundColor: isInCollection
                  ? 'var(--primary)'
                  : 'rgba(0,0,0,0.5)',
              }}
            >
              <Bookmark
                size={16}
                fill={isInCollection ? 'white' : 'none'}
                style={{ color: 'white' }}
              />
            </button>

            {/* Virtual Try-On Button */}
            <button
              onClick={handleTryOnClick}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}
              title="Virtual Try-On"
            >
              <Shirt size={16} style={{ color: 'white' }} />
            </button>
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
            <button
              onClick={handleExternalClick}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              style={{ color: 'var(--foreground-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--foreground-muted)';
              }}
              title="Shop this product"
            >
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      </div>

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
