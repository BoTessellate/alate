'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Check, Sparkles, X, FolderPlus } from 'lucide-react';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import type { CollectionMetadata } from '@/types';

interface CollectionInspirationProps {
  onApplyFilters: (metadata: CollectionMetadata) => void;
  onClearFilters: () => void;
  isFilterActive: boolean;
}

export default function CollectionInspiration({
  onApplyFilters,
  onClearFilters,
  isFilterActive,
}: CollectionInspirationProps) {
  const { collections, getAggregatedMetadata } = useCollectionsStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const toggleCollection = (collectionId: string) => {
    setSelectedCollectionIds((prev) =>
      prev.includes(collectionId)
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId]
    );
  };

  const handleApplyFilters = () => {
    if (selectedCollectionIds.length > 0) {
      const metadata = getAggregatedMetadata(selectedCollectionIds);
      onApplyFilters(metadata);
    }
  };

  const handleClearAll = () => {
    setSelectedCollectionIds([]);
    onClearFilters();
  };

  // Count total products across selected collections
  const selectedProductCount = collections
    .filter((c) => selectedCollectionIds.includes(c.id))
    .reduce((sum, c) => sum + c.products.length, 0);

  if (!isHydrated) {
    return null;
  }

  // Don't render if no collections
  if (collections.length === 0) {
    return null;
  }

  return (
    <div
      className="border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between transition-colors"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-light)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Use Collections as Inspiration
          </span>
          {isFilterActive && (
            <span
              className="px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              Active
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={16} style={{ color: 'var(--foreground-muted)' }} />
        ) : (
          <ChevronDown size={16} style={{ color: 'var(--foreground-muted)' }} />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3">
          {/* Collections List */}
          <div
            className="max-h-40 overflow-y-auto rounded-lg border mb-3"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
          >
            {collections.map((collection) => {
              const isSelected = selectedCollectionIds.includes(collection.id);
              return (
                <button
                  key={collection.id}
                  onClick={() => toggleCollection(collection.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{
                    backgroundColor: isSelected ? 'rgba(76, 112, 49, 0.1)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {/* Checkbox */}
                  <div
                    className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                      backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                    }}
                  >
                    {isSelected && <Check size={10} style={{ color: 'white' }} />}
                  </div>

                  {/* Collection preview */}
                  <div
                    className="w-8 h-8 rounded flex-shrink-0 overflow-hidden grid grid-cols-2 gap-px"
                    style={{ backgroundColor: 'var(--border)' }}
                  >
                    {collection.coverImages.slice(0, 4).map((img, i) => (
                      <div
                        key={i}
                        className="w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${img})` }}
                      />
                    ))}
                    {collection.coverImages.length === 0 && (
                      <div className="col-span-2 row-span-2 flex items-center justify-center">
                        <FolderPlus size={12} style={{ color: 'var(--foreground-muted)' }} />
                      </div>
                    )}
                  </div>

                  {/* Collection info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {collection.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {collection.products.length} item{collection.products.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected info */}
          {selectedCollectionIds.length > 0 && (
            <p className="text-xs mb-2" style={{ color: 'var(--foreground-secondary)' }}>
              {selectedCollectionIds.length} collection{selectedCollectionIds.length !== 1 ? 's' : ''} selected
              ({selectedProductCount} product{selectedProductCount !== 1 ? 's' : ''} for inspiration)
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleApplyFilters}
              disabled={selectedCollectionIds.length === 0}
              className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor:
                  selectedCollectionIds.length > 0 ? 'var(--primary)' : 'var(--surface-light)',
                color:
                  selectedCollectionIds.length > 0 ? 'white' : 'var(--foreground-muted)',
                cursor: selectedCollectionIds.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Apply to Search
            </button>
            {(selectedCollectionIds.length > 0 || isFilterActive) && (
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--surface-light)',
                  color: 'var(--foreground)',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
