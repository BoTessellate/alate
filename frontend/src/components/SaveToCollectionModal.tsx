'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Check, Plus, FolderPlus } from 'lucide-react';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import type { Product } from '@/types';

interface SaveToCollectionModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export default function SaveToCollectionModal({
  product,
  isOpen,
  onClose,
  anchorRef,
}: SaveToCollectionModalProps) {
  const {
    collections,
    createCollection,
    addProductToCollection,
    removeProductFromCollection,
    isProductInCollection,
  } = useCollectionsStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Position modal near anchor element - use useLayoutEffect to calculate before paint
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // useLayoutEffect runs synchronously before browser paint, preventing visual shift
  useLayoutEffect(() => {
    if (isOpen && anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const modalWidth = 280;
      const modalHeight = 320;

      let left = rect.left;
      let top = rect.bottom + 8;

      // Adjust if would overflow right edge
      if (left + modalWidth > window.innerWidth - 16) {
        left = window.innerWidth - modalWidth - 16;
      }

      // Adjust if would overflow bottom edge
      if (top + modalHeight > window.innerHeight - 16) {
        top = rect.top - modalHeight - 8;
      }

      setPosition({ top, left });
    } else if (!isOpen) {
      // Reset position when closed so it recalculates on next open
      setPosition(null);
    }
  }, [isOpen, anchorRef]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreating) {
          setIsCreating(false);
          setNewCollectionName('');
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isCreating, onClose]);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleToggleCollection = (collectionId: string) => {
    if (isProductInCollection(collectionId, product.id)) {
      removeProductFromCollection(collectionId, product.id);
    } else {
      addProductToCollection(collectionId, product);
    }
  };

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      const collection = createCollection(newCollectionName.trim());
      addProductToCollection(collection.id, product);
      setNewCollectionName('');
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateCollection();
    }
  };

  // Don't render until open AND position is calculated (prevents flash at 0,0)
  if (!isOpen || !position) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-to-collection-modal-title"
      className="fixed z-50 rounded-lg shadow-xl border overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        width: 280,
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <span
          id="save-to-collection-modal-title"
          className="font-medium text-sm"
          style={{ color: 'var(--foreground)' }}
        >
          Save to Collection
        </span>
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="w-11 h-11 flex items-center justify-center rounded hover:bg-opacity-10 transition-colors"
          style={{ color: 'var(--foreground-secondary)' }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Collections list */}
      <div
        className="max-h-48 overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        {collections.length === 0 && !isCreating ? (
          <div
            className="px-4 py-6 text-center text-sm"
            style={{ color: 'var(--foreground-muted)' }}
          >
            No collections yet.
            <br />
            Create one to save products!
          </div>
        ) : (
          collections.map((collection) => {
            const isInCollection = isProductInCollection(collection.id, product.id);
            return (
              <button
                key={collection.id}
                onClick={() => handleToggleCollection(collection.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-opacity-5 transition-colors text-left cursor-pointer"
                style={{
                  backgroundColor: isInCollection
                    ? 'rgba(76, 112, 49, 0.1)'
                    : 'transparent',
                }}
              >
                {/* Cover preview */}
                <div
                  className="w-10 h-10 rounded flex-shrink-0 overflow-hidden grid grid-cols-2 gap-0.5"
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
                      <FolderPlus
                        size={16}
                        aria-hidden="true"
                        style={{ color: 'var(--foreground-muted)' }}
                      />
                    </div>
                  )}
                </div>

                {/* Collection info */}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {collection.name}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    {collection.products.length} item
                    {collection.products.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Checkmark */}
                {isInCollection && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    <Check size={12} aria-hidden="true" style={{ color: 'white' }} />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Create new collection */}
      <div
        className="border-t px-4 py-3"
        style={{ borderColor: 'var(--border)' }}
      >
        {isCreating ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Collection name"
              className="flex-1 px-3 py-2 text-sm rounded border outline-none"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            <button
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim()}
              className="px-3 py-2 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: newCollectionName.trim()
                  ? 'var(--primary)'
                  : 'var(--surface-light)',
                color: newCollectionName.trim()
                  ? 'white'
                  : 'var(--foreground-muted)',
                cursor: newCollectionName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Create
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-2 py-3 min-h-[44px] rounded text-sm font-medium transition-colors cursor-pointer"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--foreground-secondary)',
              border: '1px dashed var(--border)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--foreground-muted)';
              e.currentTarget.style.color = 'var(--foreground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--foreground-secondary)';
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Create Collection
          </button>
        )}
      </div>
    </div>
  );
}
