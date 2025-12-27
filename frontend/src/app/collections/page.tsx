'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Heart, MoreHorizontal, Trash2, Edit2, FolderOpen, FolderPlus } from 'lucide-react';
import { useCollectionsStore } from '@/stores/useCollectionsStore';

export default function CollectionsPage() {
  const router = useRouter();
  const {
    collections,
    createCollection,
    deleteCollection,
    renameCollection,
  } = useCollectionsStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenu(null);
    };

    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeMenu]);

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    createCollection(newCollectionName, newCollectionDesc || undefined);
    setNewCollectionName('');
    setNewCollectionDesc('');
    setShowCreateModal(false);
  };

  const handleDeleteCollection = (id: string) => {
    deleteCollection(id);
    setActiveMenu(null);
  };

  const handleStartRename = (collection: { id: string; name: string }) => {
    setEditingId(collection.id);
    setEditingName(collection.name);
    setActiveMenu(null);
  };

  const handleSaveRename = () => {
    if (editingId && editingName.trim()) {
      renameCollection(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCollectionClick = (collectionId: string) => {
    if (editingId !== collectionId) {
      router.push(`/collections/${collectionId}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Show loading while hydrating
  if (!isHydrated) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-10 w-48 rounded mb-2" style={{ backgroundColor: 'var(--surface)' }} />
          <div className="h-5 w-64 rounded mb-8" style={{ backgroundColor: 'var(--surface)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                <div className="aspect-video" style={{ backgroundColor: 'var(--background-secondary)' }} />
                <div className="p-4">
                  <div className="h-5 w-32 rounded mb-2" style={{ backgroundColor: 'var(--background-secondary)' }} />
                  <div className="h-4 w-48 rounded" style={{ backgroundColor: 'var(--background-secondary)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Collections
          </h1>
          <p style={{ color: 'var(--foreground-secondary)' }}>
            Organize your favorite products into collections.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary)';
          }}
        >
          <Plus size={20} />
          New Collection
        </button>
      </div>

      {/* Empty State */}
      {collections.length === 0 && (
        <div
          className="text-center py-20 rounded-lg border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <FolderOpen
            size={48}
            className="mx-auto mb-4"
            style={{ color: 'var(--foreground-muted)' }}
          />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            No collections yet
          </h3>
          <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>
            Create a collection to start organizing your favorite products.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'white',
            }}
          >
            <Plus size={18} />
            Create Collection
          </button>
        </div>
      )}

      {/* Collections Grid */}
      {collections.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <div
              key={collection.id}
              onClick={() => handleCollectionClick(collection.id)}
              className="group rounded-lg border overflow-hidden transition-all duration-200 cursor-pointer"
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
              {/* Cover Image Grid */}
              <div
                className="aspect-video relative"
                style={{
                  backgroundColor: 'var(--background-secondary)',
                }}
              >
                {collection.coverImages.length > 0 ? (
                  <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                    {collection.coverImages.slice(0, 4).map((img, idx) => (
                      <div
                        key={idx}
                        className="w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${img})` }}
                      />
                    ))}
                    {/* Fill remaining slots if less than 4 images */}
                    {Array.from({ length: Math.max(0, 4 - collection.coverImages.length) }).map(
                      (_, idx) => (
                        <div
                          key={`empty-${idx}`}
                          className="w-full h-full"
                          style={{ backgroundColor: 'var(--border)' }}
                        />
                      )
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FolderPlus
                      size={48}
                      style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}
                    />
                  </div>
                )}

                {/* Menu Button */}
                <div className="absolute top-2 right-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === collection.id ? null : collection.id);
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: 'white',
                    }}
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenu === collection.id && (
                    <div
                      className="absolute top-10 right-0 w-40 rounded-lg overflow-hidden shadow-lg z-10"
                      style={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(collection);
                        }}
                        className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                        style={{ color: 'var(--foreground)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Edit2 size={14} />
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCollection(collection.id);
                        }}
                        className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                        style={{ color: 'var(--error)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Collection Info */}
              <div className="p-4">
                {editingId === collection.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleSaveRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename();
                      if (e.key === 'Escape') {
                        setEditingId(null);
                        setEditingName('');
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold mb-1 w-full bg-transparent border-b outline-none"
                    style={{
                      color: 'var(--foreground)',
                      borderColor: 'var(--primary)',
                    }}
                    autoFocus
                  />
                ) : (
                  <h3 className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                    {collection.name}
                  </h3>
                )}
                {collection.description && (
                  <p
                    className="text-sm mb-3 line-clamp-2"
                    style={{ color: 'var(--foreground-secondary)' }}
                  >
                    {collection.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--foreground-muted)' }}>
                    {collection.products.length}{' '}
                    {collection.products.length === 1 ? 'item' : 'items'}
                  </span>
                  <span style={{ color: 'var(--foreground-muted)' }}>
                    Updated {formatDate(collection.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md p-6 rounded-lg mx-4"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
              Create Collection
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCollectionName.trim()) {
                      handleCreateCollection();
                    }
                  }}
                  placeholder="e.g., Summer Favorites"
                  className="w-full p-3 rounded-lg border outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  Description (optional)
                </label>
                <textarea
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  placeholder="What's this collection about?"
                  rows={3}
                  className="w-full p-3 rounded-lg border outline-none resize-none"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--surface-light)',
                  color: 'var(--foreground)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim()}
                className="flex-1 py-2.5 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: newCollectionName.trim()
                    ? 'var(--primary)'
                    : 'var(--surface-light)',
                  color: newCollectionName.trim() ? 'white' : 'var(--foreground-muted)',
                  cursor: newCollectionName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
