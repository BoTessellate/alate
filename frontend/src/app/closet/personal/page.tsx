'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Grid3X3, MoreHorizontal, FolderPlus, ChevronDown, Trash2, Edit2 } from 'lucide-react';
import { Button, EmptyState, PageHeader, Input, Modal, ModalContent, ModalFooter, Textarea, DropdownItem } from '@/components/ui';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useUploadStore } from '@/stores/useUploadStore';
import type { Product } from '@/types';

export default function PersonalCollectionPage() {
  const {
    collections,
    createCollection,
    deleteCollection,
    renameCollection,
    removeProductFromCollection,
  } = useCollectionsStore();
  const { openModal } = useUploadStore();

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [activeItemMenu, setActiveItemMenu] = useState<string | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [sidebarCollectionMenu, setSidebarCollectionMenu] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveItemMenu(null);
      setSidebarCollectionMenu(null);
      setMobileDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Get all items or filtered by collection
  const displayedItems = useMemo(() => {
    if (!selectedCollectionId) {
      // All items from all collections (deduplicated by id)
      const allProducts = collections.flatMap(c => c.products);
      const uniqueProducts = new Map<string, Product>();
      allProducts.forEach(p => uniqueProducts.set(p.id, p));
      return Array.from(uniqueProducts.values());
    }
    const collection = collections.find(c => c.id === selectedCollectionId);
    return collection?.products || [];
  }, [collections, selectedCollectionId]);

  const selectedCollectionName = useMemo(() => {
    if (!selectedCollectionId) return 'All Items';
    return collections.find(c => c.id === selectedCollectionId)?.name || 'All Items';
  }, [collections, selectedCollectionId]);

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    createCollection(newCollectionName, newCollectionDesc || undefined);
    setNewCollectionName('');
    setNewCollectionDesc('');
    setShowCreateModal(false);
  };

  const handleStartRename = (collection: { id: string; name: string }) => {
    setEditingCollectionId(collection.id);
    setEditingName(collection.name);
    setSidebarCollectionMenu(null);
  };

  const handleSaveRename = () => {
    if (editingCollectionId && editingName.trim()) {
      renameCollection(editingCollectionId, editingName.trim());
    }
    setEditingCollectionId(null);
    setEditingName('');
  };

  const handleDeleteCollection = (id: string) => {
    if (selectedCollectionId === id) {
      setSelectedCollectionId(null);
    }
    deleteCollection(id);
    setSidebarCollectionMenu(null);
  };

  const handleRemoveItem = (productId: string) => {
    if (selectedCollectionId) {
      removeProductFromCollection(selectedCollectionId, productId);
    }
    setActiveItemMenu(null);
  };

  // Loading state
  if (!isHydrated) {
    return (
      <div style={{ backgroundColor: 'var(--background)' }} className="min-h-screen">
        <PageHeader title="Personal" subtitle="Your saved items and wardrobe" />
        <div className="px-8 pb-24 max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="flex gap-6">
              <div className="w-52 space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-10 rounded-lg" style={{ backgroundColor: 'var(--surface)' }} />
                ))}
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="aspect-square rounded-lg" style={{ backgroundColor: 'var(--surface)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--background)' }} className="min-h-screen">
      {/* Header Section */}
      <PageHeader
        title="Personal"
        subtitle="Your saved items and wardrobe"
        actions={
          <Button variant="primary" icon={Plus} onClick={openModal}>
            Add Item
          </Button>
        }
      />

      {/* Content area with sidebar */}
      <div className="px-8 pb-24 max-w-7xl mx-auto">
        <div className="flex gap-6">
          {/* Collections Sidebar - Desktop */}
          <aside className="hidden md:block w-52 flex-shrink-0">
            <div className="sticky top-4 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--foreground-muted)' }}>
                Collections
              </p>

              {/* All Items */}
              <button
                onClick={() => setSelectedCollectionId(null)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: !selectedCollectionId ? 'var(--primary-alpha)' : 'transparent',
                  color: !selectedCollectionId ? 'var(--primary-dark)' : 'var(--foreground)',
                  fontWeight: !selectedCollectionId ? 500 : 400,
                }}
              >
                <span className="flex items-center justify-between">
                  <span>All Items</span>
                  <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {collections.reduce((acc, c) => {
                      c.products.forEach(p => acc.add(p.id));
                      return acc;
                    }, new Set()).size}
                  </span>
                </span>
              </button>

              {/* Collection List */}
              {collections.map(collection => (
                <div key={collection.id} className="relative group">
                  {editingCollectionId === collection.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleSaveRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename();
                        if (e.key === 'Escape') {
                          setEditingCollectionId(null);
                          setEditingName('');
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none"
                      style={{ borderColor: 'var(--primary-dark)', color: 'var(--foreground)' }}
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => setSelectedCollectionId(collection.id)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        backgroundColor: selectedCollectionId === collection.id ? 'var(--primary-alpha)' : 'transparent',
                        color: selectedCollectionId === collection.id ? 'var(--primary-dark)' : 'var(--foreground)',
                        fontWeight: selectedCollectionId === collection.id ? 500 : 400,
                      }}
                    >
                      <span className="flex items-center justify-between">
                        <span className="truncate pr-2">{collection.name}</span>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--foreground-muted)' }}>
                          {collection.products.length}
                        </span>
                      </span>
                    </button>
                  )}

                  {/* Collection Menu Button */}
                  {editingCollectionId !== collection.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSidebarCollectionMenu(sidebarCollectionMenu === collection.id ? null : collection.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: 'var(--surface-light)' }}
                    >
                      <MoreHorizontal size={14} style={{ color: 'var(--foreground-muted)' }} />
                    </button>
                  )}

                  {/* Collection Dropdown Menu */}
                  {sidebarCollectionMenu === collection.id && (
                    <div
                      className="absolute right-0 top-full mt-1 w-32 rounded-lg overflow-hidden shadow-lg z-20 py-1"
                      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownItem
                        icon={<Edit2 size={12} />}
                        onClick={() => handleStartRename(collection)}
                        closeOnClick={false}
                      >
                        Rename
                      </DropdownItem>
                      <DropdownItem
                        icon={<Trash2 size={12} />}
                        variant="destructive"
                        onClick={() => handleDeleteCollection(collection.id)}
                        closeOnClick={false}
                      >
                        Delete
                      </DropdownItem>
                    </div>
                  )}
                </div>
              ))}

              {/* New Collection Button */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                style={{ color: 'var(--foreground-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-light)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <FolderPlus size={14} />
                <span>New Collection</span>
              </button>
            </div>
          </aside>

          {/* Mobile Collection Dropdown */}
          <div className="md:hidden w-full mb-4">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMobileDropdownOpen(!mobileDropdownOpen);
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <span>{selectedCollectionName}</span>
                <ChevronDown
                  size={16}
                  className={`transition-transform ${mobileDropdownOpen ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--foreground-muted)' }}
                />
              </button>

              {mobileDropdownOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setSelectedCollectionId(null);
                      setMobileDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm"
                    style={{
                      backgroundColor: !selectedCollectionId ? 'var(--primary-alpha)' : 'transparent',
                      color: !selectedCollectionId ? 'var(--primary-dark)' : 'var(--foreground)',
                    }}
                  >
                    All Items
                  </button>
                  {collections.map(collection => (
                    <button
                      key={collection.id}
                      onClick={() => {
                        setSelectedCollectionId(collection.id);
                        setMobileDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm"
                      style={{
                        backgroundColor: selectedCollectionId === collection.id ? 'var(--primary-alpha)' : 'transparent',
                        color: selectedCollectionId === collection.id ? 'var(--primary-dark)' : 'var(--foreground)',
                      }}
                    >
                      {collection.name} ({collection.products.length})
                    </button>
                  ))}
                  <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
                  <button
                    onClick={() => {
                      setShowCreateModal(true);
                      setMobileDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    <FolderPlus size={14} />
                    New Collection
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            {displayedItems.length === 0 ? (
              <EmptyState
                icon={Grid3X3}
                title={selectedCollectionId ? 'This collection is empty' : 'Your closet is empty'}
                description={
                  selectedCollectionId
                    ? 'Add items to this collection from your closet.'
                    : 'Start building your personal collection by uploading items.'
                }
                action={{
                  label: 'Add Item',
                  onClick: openModal,
                  icon: Plus,
                }}
              />
            ) : (
              <>
                {/* Items count header */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                    {displayedItems.length} item{displayedItems.length !== 1 ? 's' : ''}
                    {selectedCollectionId && ` in ${selectedCollectionName}`}
                  </p>
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {displayedItems.map((item) => (
                    <div
                      key={item.id}
                      className="group relative rounded-lg overflow-hidden aspect-square border"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.product_name || 'Product'}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div
                        className="absolute inset-x-0 bottom-0 p-3"
                        style={{
                          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                        }}
                      >
                        <p className="text-sm font-medium text-white truncate">
                          {item.product_name || item.brand || 'Unnamed'}
                        </p>
                        {item.brand && item.product_name && (
                          <p className="text-xs text-white/70 truncate">{item.brand}</p>
                        )}
                      </div>

                      {/* Item Menu Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveItemMenu(activeItemMenu === item.id ? null : item.id);
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          color: 'white',
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {/* Item Dropdown Menu */}
                      {activeItemMenu === item.id && selectedCollectionId && (
                        <div
                          className="absolute top-12 right-2 w-36 rounded-lg overflow-hidden shadow-lg z-20 py-1"
                          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownItem
                            icon={<Trash2 size={12} />}
                            variant="destructive"
                            onClick={() => handleRemoveItem(item.id)}
                            closeOnClick={false}
                          >
                            Remove from collection
                          </DropdownItem>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* Create Collection Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Collection"
        size="sm"
      >
        <ModalContent className="space-y-4">
          <Input
            label="Name"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCollectionName.trim()) {
                handleCreateCollection();
              }
            }}
            placeholder="e.g., Summer Favorites"
            autoFocus
          />
          <Textarea
            label="Description (optional)"
            value={newCollectionDesc}
            onChange={(e) => setNewCollectionDesc(e.target.value)}
            placeholder="What's this collection about?"
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateCollection}
            disabled={!newCollectionName.trim()}
          >
            Create
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
