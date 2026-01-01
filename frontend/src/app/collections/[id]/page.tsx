'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  MoreHorizontal,
  Edit2,
  Trash2,
  X,
  FolderOpen,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { usePriceFormatter } from '@/hooks/useCurrency';
import { getProductUrl } from '@/utils/placeholder';
import { EmptyState, Button } from '@/components/ui';
import type { Product } from '@/types';

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

export default function CollectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const collectionId = params.id as string;

  const {
    getCollectionById,
    removeProductFromCollection,
    renameCollection,
    updateCollectionDescription,
    deleteCollection,
  } = useCollectionsStore();

  const { format } = usePriceFormatter();

  const [collection, setCollection] = useState(() => getCollectionById(collectionId));
  const [isHydrated, setIsHydrated] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Refresh collection data when store changes
  useEffect(() => {
    if (isHydrated) {
      setCollection(getCollectionById(collectionId));
    }
  }, [isHydrated, collectionId, getCollectionById]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowMenu(false);
    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMenu]);

  const handleRemoveProduct = (productId: string) => {
    removeProductFromCollection(collectionId, productId);
    setCollection(getCollectionById(collectionId));
  };

  const handleDelete = () => {
    deleteCollection(collectionId);
    router.push('/collections');
  };

  const handleStartEdit = () => {
    if (collection) {
      setEditName(collection.name);
      setEditDescription(collection.description || '');
      setIsEditing(true);
      setShowMenu(false);
    }
  };

  const handleSaveEdit = () => {
    if (collection && editName.trim()) {
      renameCollection(collectionId, editName.trim());
      updateCollectionDescription(collectionId, editDescription);
      setCollection(getCollectionById(collectionId));
      setIsEditing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Loading state
  if (!isHydrated) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 w-32 rounded mb-6" style={{ backgroundColor: 'var(--surface)' }} />
          <div className="h-10 w-64 rounded mb-2" style={{ backgroundColor: 'var(--surface)' }} />
          <div className="h-5 w-48 rounded mb-8" style={{ backgroundColor: 'var(--surface)' }} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-square rounded-lg" style={{ backgroundColor: 'var(--surface)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Collection not found
  if (!collection) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <button
          onClick={() => router.push('/collections')}
          className="flex items-center gap-2 mb-8 transition-colors"
          style={{ color: 'var(--foreground-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--foreground-secondary)')}
        >
          <ArrowLeft size={20} />
          Back to Collections
        </button>
        <div
          className="text-center py-20 rounded-lg border"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <FolderOpen size={48} className="mx-auto mb-4" style={{ color: 'var(--foreground-muted)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            Collection not found
          </h3>
          <p style={{ color: 'var(--foreground-secondary)' }}>
            This collection may have been deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.push('/collections')}
        className="flex items-center gap-2 mb-6 transition-colors"
        style={{ color: 'var(--foreground-secondary)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--foreground-secondary)')}
      >
        <ArrowLeft size={20} />
        Back to Collections
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3 max-w-lg">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-3xl italic w-full bg-transparent border-b-2 outline-none"
                style={{
                  fontFamily: 'var(--font-cormorant)',
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  borderColor: 'var(--primary)',
                }}
                autoFocus
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description..."
                rows={2}
                className="w-full p-2 rounded border outline-none resize-none text-sm"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 rounded text-sm font-medium"
                  style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-1.5 rounded text-sm font-medium"
                  style={{ backgroundColor: 'var(--surface-light)', color: 'var(--foreground)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1
                className="text-3xl italic"
                style={{
                  fontFamily: 'var(--font-cormorant)',
                  fontWeight: 500,
                  color: 'var(--foreground)',
                }}
              >
                {collection.name}
              </h1>
              <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                {collection.products.length} {collection.products.length === 1 ? 'item' : 'items'}
                {' · '}
                Updated {formatDate(collection.updatedAt)}
              </span>
              {collection.description && (
                <p className="w-full text-sm mt-1" style={{ color: 'var(--foreground-secondary)' }}>
                  {collection.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions Menu */}
        {!isEditing && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-light)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
            >
              <MoreHorizontal size={20} />
            </button>

            {showMenu && (
              <div
                className="absolute top-12 right-0 w-44 rounded-lg overflow-hidden shadow-lg z-10"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleStartEdit}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                  style={{ color: 'var(--foreground)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-light)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Edit2 size={14} />
                  Edit Collection
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                  style={{ color: 'var(--error)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-light)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Trash2 size={14} />
                  Delete Collection
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {collection.products.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="No products yet"
          description="Browse the Discover page to add products to this collection."
          action={{
            label: 'Go to Discover',
            onClick: () => router.push('/discover'),
          }}
          size="lg"
        />
      )}

      {/* Products Grid */}
      {collection.products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {collection.products.map((product) => (
            <div
              key={product.id}
              className="group rounded-lg border overflow-hidden transition-all"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
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
                    className="w-full h-full"
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, var(--primary) 0%, var(--cream-dark) 100%)',
                      opacity: 0.5,
                    }}
                  />
                )}

                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Shop Button */}
                  <button
                    onClick={() => window.open(getProductUrl(product.brand, product.product_name), '_blank', 'noopener,noreferrer')}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                    title="Shop this product"
                  >
                    <ExternalLink size={14} style={{ color: 'white' }} />
                  </button>
                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveProduct(product.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                    title="Remove from collection"
                  >
                    <X size={14} style={{ color: 'white' }} />
                  </button>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-3">
                <p
                  className="text-xs font-medium uppercase tracking-wide mb-0.5"
                  style={{ color: 'var(--primary)' }}
                >
                  {normalizeText(product.brand)}
                </p>
                <h3
                  className="font-medium text-sm mb-1 line-clamp-1"
                  style={{ color: 'var(--foreground)' }}
                >
                  {normalizeText(product.product_name)}
                </h3>
                <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                  {format(product.price, product.currency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
