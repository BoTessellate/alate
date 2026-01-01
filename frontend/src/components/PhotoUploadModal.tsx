'use client';

import { useCallback, useEffect, useRef } from 'react';
import { X, Upload, Loader2, Check, AlertCircle, Plus } from 'lucide-react';
import { useUploadStore, ProductType } from '@/stores/useUploadStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { Button, IconButton, Input } from '@/components/ui';

/**
 * Modal for uploading and processing product photos
 */
export default function PhotoUploadModal() {
  const {
    isModalOpen,
    closeModal,
    status,
    progress,
    error,
    selectedFile,
    previewUrl,
    productType,
    productData,
    selectedCollections,
    setFile,
    setProductType,
    updateProductField,
    toggleCollection,
  } = useUploadStore();

  const { collections, createCollection } = useCollectionsStore();
  const { uploadAndProcess, saveToCollections } = usePhotoUpload();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const newCollectionInputRef = useRef<HTMLInputElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) closeModal();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, closeModal]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setFile(file);
    },
    [setFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) setFile(file);
    },
    [setFile]
  );

  const handleUpload = useCallback(async () => {
    if (selectedFile) await uploadAndProcess();
  }, [selectedFile, uploadAndProcess]);

  const handleSave = useCallback(async () => {
    const success = await saveToCollections();
    if (success) {
      setTimeout(() => closeModal(), 1000);
    }
  }, [saveToCollections, closeModal]);

  const handleCreateCollection = useCallback(() => {
    const input = newCollectionInputRef.current;
    if (input && input.value.trim()) {
      const newCollection = createCollection(input.value.trim());
      toggleCollection(newCollection.id);
      input.value = '';
    }
  }, [createCollection, toggleCollection]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      const currentTags = productData?.tags || [];
      updateProductField('tags', currentTags.filter((tag) => tag !== tagToRemove));
    },
    [productData?.tags, updateProductField]
  );

  if (!isModalOpen) return null;

  const isProcessing = status === 'uploading' || status === 'processing';
  const canEdit = status === 'editing' || status === 'error';
  const isSaving = status === 'saving';
  const isSuccess = status === 'success';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-end p-4 pb-24 pr-6"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-upload-modal-title"
        className="w-full max-w-md rounded-xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', maxHeight: '70vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 id="photo-upload-modal-title" className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Upload Product Photo
          </h2>
          <IconButton icon={X} aria-label="Close modal" onClick={closeModal} />
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Drop Zone / Preview */}
          <div
            className="relative rounded-lg border-2 border-dashed overflow-hidden transition-colors"
            style={{
              borderColor: selectedFile ? 'var(--primary)' : 'var(--border)',
              backgroundColor: 'var(--background-secondary)',
              minHeight: '200px',
            }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <div className="relative w-full h-[200px]">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                {!isProcessing && !canEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    aria-label="Remove selected image"
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >
                    <X size={16} color="white" aria-hidden="true" />
                  </button>
                )}
                {isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <Loader2 size={32} className="animate-spin mb-2" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                    <p className="text-sm text-white">{status === 'uploading' ? 'Uploading...' : 'Processing...'}</p>
                    <div className="w-32 h-1 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                      <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: 'var(--primary)' }} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 cursor-pointer">
                <Upload size={40} style={{ color: 'var(--foreground-muted)' }} aria-hidden="true" />
                <p className="mt-3 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Drag & drop or click to upload
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  JPG, PNG, or WebP (max 10MB)
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--error)', color: 'white' }}>
              <AlertCircle size={18} aria-hidden="true" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--success)', color: 'white' }}>
              <Check size={18} aria-hidden="true" />
              <p className="text-sm">Product saved to collection!</p>
            </div>
          )}

          {/* Product Type Selection */}
          {!canEdit && !isProcessing && !isSuccess && selectedFile && (
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--foreground)' }}>
                Product Type
              </label>
              <div className="flex gap-2">
                {(['fashion', 'home'] as ProductType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setProductType(type)}
                    className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    style={{
                      backgroundColor: productType === type ? 'var(--primary)' : 'var(--background-secondary)',
                      color: productType === type ? 'white' : 'var(--foreground)',
                      border: `1px solid ${productType === type ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    {type === 'fashion' ? 'Fashion' : 'Home'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          {!canEdit && !isProcessing && !isSuccess && selectedFile && (
            <Button className="w-full" onClick={handleUpload}>
              Process Image
            </Button>
          )}

          {/* Editing Form */}
          {canEdit && productData && (
            <div className="space-y-4">
              <Input
                label="Brand"
                value={productData.brand || ''}
                onChange={(e) => updateProductField('brand', e.target.value)}
                placeholder="Enter brand name"
              />

              <Input
                label="Name"
                value={productData.product_name || ''}
                onChange={(e) => updateProductField('product_name', e.target.value)}
                placeholder="Product name"
              />

              <Input
                label="Size"
                value={productData.size || ''}
                onChange={(e) => updateProductField('size', e.target.value)}
                placeholder="e.g., M, 42, 10x12"
              />

              {/* Price */}
              <div className="flex gap-2">
                <Input
                  label="Price"
                  type="number"
                  value={productData.price || ''}
                  onChange={(e) => updateProductField('price', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="flex-1"
                />
                <div className="w-24">
                  <label htmlFor="product-currency" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    Currency
                  </label>
                  <select
                    id="product-currency"
                    value={productData.currency || 'USD'}
                    onChange={(e) => updateProductField('currency', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg text-sm outline-none cursor-pointer"
                    style={{
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                    }}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>

              {/* AI Tags */}
              <div>
                <span className="text-sm font-medium mb-2 block" style={{ color: 'var(--foreground)' }}>
                  Tags
                </span>
                <div className="flex flex-wrap gap-2">
                  {(productData.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                      style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                    >
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} aria-label={`Remove tag ${tag}`} className="hover:opacity-70 cursor-pointer">
                        <X size={12} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Collection Selection */}
              <div>
                <span className="text-sm font-medium mb-2 block" style={{ color: 'var(--foreground)' }}>
                  Save to Collection
                </span>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {collections.map((collection) => (
                    <label
                      key={collection.id}
                      htmlFor={`collection-${collection.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
                      style={{
                        backgroundColor: selectedCollections.includes(collection.id) ? 'var(--primary-alpha)' : 'transparent',
                      }}
                    >
                      <input
                        id={`collection-${collection.id}`}
                        type="checkbox"
                        checked={selectedCollections.includes(collection.id)}
                        onChange={() => toggleCollection(collection.id)}
                        className="rounded cursor-pointer"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                        {collection.name}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        ({collection.products.length} items)
                      </span>
                    </label>
                  ))}

                  {/* New Collection Input */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      ref={newCollectionInputRef}
                      type="text"
                      placeholder="New collection name..."
                      className="flex-1 px-3 py-2 h-10 rounded-lg text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--background)',
                        border: '1px solid var(--border)',
                        color: 'var(--foreground)',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateCollection();
                      }}
                    />
                    <IconButton icon={Plus} aria-label="Create new collection" onClick={handleCreateCollection} />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={isSaving || selectedCollections.length === 0}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    'Save Product'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
