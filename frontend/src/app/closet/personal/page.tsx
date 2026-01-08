'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Grid3X3, MoreHorizontal, FolderPlus, ChevronDown, Trash2, Edit2, X } from 'lucide-react';
import { Button, EmptyState, PageHeader, Input, Modal, ModalContent, ModalFooter, Textarea, DropdownItem, TagList } from '@/components/ui';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useUploadStore } from '@/stores/useUploadStore';
import type { Product } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-tml.vercel.app';

export default function PersonalCollectionPage() {
  const {
    collections,
    createCollection,
    deleteCollection,
    renameCollection,
    removeProductFromCollection,
    updateProductInCollection,
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

  // Edit product state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProductForm, setEditProductForm] = useState({
    product_name: '',
    brand: '',
    price: '',
    category: '',
    tags: [] as string[],
  });
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [originalTags, setOriginalTags] = useState<string[]>([]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicking on a menu button (data-menu-trigger attribute)
      const target = e.target as HTMLElement;
      if (target.closest('[data-menu-trigger]')) {
        return;
      }
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

  const handleStartEditProduct = (product: Product) => {
    setEditingProduct(product);
    const productTags = product.tags || [];
    setEditProductForm({
      product_name: product.product_name || '',
      brand: product.brand || '',
      price: product.price?.toString() || '',
      category: product.category || '',
      tags: productTags,
    });
    setOriginalTags(productTags); // Store original tags for feedback comparison
    setNewTagInput('');
    setIsAddingTag(false);
    setActiveItemMenu(null);
  };

  // Submit tag feedback to help AI learn from user corrections
  const submitTagFeedback = useCallback(async (
    productId: string,
    originalTags: string[],
    newTags: string[],
    brand?: string,
    category?: string
  ) => {
    // Check if tags were actually changed
    const tagsChanged =
      newTags.length !== originalTags.length ||
      !newTags.every((t) => originalTags.includes(t));

    if (!tagsChanged || originalTags.length === 0) return;

    try {
      await fetch(`${API_BASE_URL}/api/ai?action=feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: {
            product_id: productId,
            brand: brand,
            category: category,
            ai_generated_tags: originalTags,
            user_final_tags: newTags,
            source: 'closet_edit', // Track this came from closet edit modal
          },
        }),
      });
      // Silent - don't show errors to user for feedback
    } catch {
      // Ignore feedback errors - non-critical
    }
  }, []);

  const handleSaveProductEdit = () => {
    if (!editingProduct) return;

    const finalTags = editProductForm.tags.length > 0 ? editProductForm.tags : editingProduct.tags || [];

    // Submit tag feedback for AI learning (async, non-blocking)
    submitTagFeedback(
      editingProduct.id,
      originalTags,
      finalTags,
      editProductForm.brand || editingProduct.brand,
      editProductForm.category || editingProduct.category
    );

    const updates: Partial<Product> = {
      product_name: editProductForm.product_name || editingProduct.product_name,
      brand: editProductForm.brand || undefined,
      price: editProductForm.price ? parseFloat(editProductForm.price) : undefined,
      category: editProductForm.category || undefined,
      tags: finalTags,
    };

    // Find all collections containing this product and update in each
    collections.forEach(collection => {
      if (collection.products.some(p => p.id === editingProduct.id)) {
        updateProductInCollection(collection.id, editingProduct.id, updates);
      }
    });

    setEditingProduct(null);
  };

  const handleAddTag = () => {
    const tag = newTagInput.trim().toLowerCase();
    if (tag && !editProductForm.tags.includes(tag)) {
      setEditProductForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditProductForm(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove),
    }));
  };

  const handleCancelProductEdit = () => {
    setEditingProduct(null);
    setEditProductForm({
      product_name: '',
      brand: '',
      price: '',
      category: '',
      tags: [],
    });
    setNewTagInput('');
    setIsAddingTag(false);
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
                        data-menu-trigger
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
                      {activeItemMenu === item.id && (
                        <div
                          className="absolute top-12 right-2 w-36 rounded-lg overflow-hidden shadow-lg z-20 py-1"
                          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownItem
                            icon={<Edit2 size={12} />}
                            onClick={() => handleStartEditProduct(item)}
                            closeOnClick={false}
                          >
                            Edit details
                          </DropdownItem>
                          {selectedCollectionId && (
                            <DropdownItem
                              icon={<Trash2 size={12} />}
                              variant="destructive"
                              onClick={() => handleRemoveItem(item.id)}
                              closeOnClick={false}
                            >
                              Remove
                            </DropdownItem>
                          )}
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

      {/* Edit Product Modal */}
      <Modal
        isOpen={!!editingProduct}
        onClose={handleCancelProductEdit}
        title="Edit Product"
        size="sm"
      >
        <ModalContent className="space-y-4">
          {editingProduct?.image_url && (
            <div className="flex justify-center mb-2">
              <img
                src={editingProduct.image_url}
                alt={editingProduct.product_name || 'Product'}
                className="w-24 h-24 object-cover rounded-lg"
              />
            </div>
          )}
          <Input
            label="Product Name"
            value={editProductForm.product_name}
            onChange={(e) => setEditProductForm(prev => ({ ...prev, product_name: e.target.value }))}
            placeholder="e.g., Oversized Blazer"
          />
          <Input
            label="Brand"
            value={editProductForm.brand}
            onChange={(e) => setEditProductForm(prev => ({ ...prev, brand: e.target.value }))}
            placeholder="e.g., Zara"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Price"
              type="number"
              value={editProductForm.price}
              onChange={(e) => setEditProductForm(prev => ({ ...prev, price: e.target.value }))}
              placeholder="0.00"
            />
            <Input
              label="Category"
              value={editProductForm.category}
              onChange={(e) => setEditProductForm(prev => ({ ...prev, category: e.target.value }))}
              placeholder="e.g., Tops"
            />
          </div>
          {/* Tags Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Tags ({editProductForm.tags.length})
              </span>
              {!isAddingTag && (
                <button
                  type="button"
                  onClick={() => setIsAddingTag(true)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors"
                  style={{ color: 'var(--primary)' }}
                >
                  <Plus size={12} />
                  Add
                </button>
              )}
            </div>

            {/* Add Tag Input */}
            {isAddingTag && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    } else if (e.key === 'Escape') {
                      setNewTagInput('');
                      setIsAddingTag(false);
                    }
                  }}
                  placeholder="Enter tag..."
                  autoFocus
                  className="flex-1 px-3 py-1.5 text-xs rounded-full outline-none"
                  style={{
                    backgroundColor: 'var(--surface)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={!newTagInput.trim()}
                  className="px-3 py-1.5 text-xs rounded-full transition-colors"
                  style={{
                    backgroundColor: newTagInput.trim() ? 'var(--primary)' : 'var(--surface)',
                    color: newTagInput.trim() ? 'white' : 'var(--foreground-muted)',
                    cursor: newTagInput.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewTagInput('');
                    setIsAddingTag(false);
                  }}
                  className="px-2 py-1.5 text-xs rounded-full"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Tags Display */}
            {editProductForm.tags.length > 0 ? (
              <TagList
                tags={editProductForm.tags}
                onRemove={handleRemoveTag}
                size="md"
              />
            ) : (
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                No tags added yet
              </p>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={handleCancelProductEdit}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveProductEdit}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
