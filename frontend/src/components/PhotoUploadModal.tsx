'use client';

import { useCallback, useEffect, useRef } from 'react';
import { X, Upload, Loader2, Check, AlertCircle, Plus } from 'lucide-react';
import { useUploadStore, ProductType } from '@/stores/useUploadStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';

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
  const { uploadAndProcess, saveToCollections, resetUpload } = usePhotoUpload();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const newCollectionInputRef = useRef<HTMLInputElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, closeModal]);

  // Handle file selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setFile(file);
      }
    },
    [setFile]
  );

  // Handle drag and drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        setFile(file);
      }
    },
    [setFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Handle upload button click
  const handleUpload = useCallback(async () => {
    if (selectedFile) {
      await uploadAndProcess();
    }
  }, [selectedFile, uploadAndProcess]);

  // Handle save button click
  const handleSave = useCallback(async () => {
    const success = await saveToCollections();
    if (success) {
      // Close modal after a brief delay to show success state
      setTimeout(() => {
        closeModal();
      }, 1000);
    }
  }, [saveToCollections, closeModal]);

  // Handle new collection creation
  const handleCreateCollection = useCallback(() => {
    const input = newCollectionInputRef.current;
    if (input && input.value.trim()) {
      const newCollection = createCollection(input.value.trim());
      toggleCollection(newCollection.id);
      input.value = '';
    }
  }, [createCollection, toggleCollection]);

  // Handle tag removal
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Upload Product Photo
          </h2>
          <button
            onClick={closeModal}
            className="p-1 rounded-md transition-colors cursor-pointer"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
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
            onDragOver={handleDragOver}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <div className="relative w-full h-[200px]">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
                {!isProcessing && !canEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full cursor-pointer"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >
                    <X size={16} color="white" />
                  </button>
                )}
                {isProcessing && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                  >
                    <Loader2
                      size={32}
                      className="animate-spin mb-2"
                      style={{ color: 'var(--primary)' }}
                    />
                    <p className="text-sm text-white">
                      {status === 'uploading' ? 'Uploading...' : 'Processing...'}
                    </p>
                    <div
                      className="w-32 h-1 rounded-full mt-2 overflow-hidden"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                    >
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: 'var(--primary)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 cursor-pointer">
                <Upload size={40} style={{ color: 'var(--foreground-muted)' }} />
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
            <div
              className="flex items-center gap-2 p-3 rounded-lg"
              style={{ backgroundColor: 'var(--error)', color: 'white' }}
            >
              <AlertCircle size={18} />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg"
              style={{ backgroundColor: 'var(--success)', color: 'white' }}
            >
              <Check size={18} />
              <p className="text-sm">Product saved to collection!</p>
            </div>
          )}

          {/* Product Type Selection - Only show before processing */}
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

          {/* Upload Button - Only show before processing */}
          {!canEdit && !isProcessing && !isSuccess && selectedFile && (
            <button
              onClick={handleUpload}
              className="w-full py-3 rounded-lg font-medium transition-colors cursor-pointer"
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
              Process Image
            </button>
          )}

          {/* Editing Form - Only show after processing */}
          {canEdit && productData && (
            <div className="space-y-4">
              {/* Brand */}
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--foreground)' }}>
                  Brand
                </label>
                <input
                  type="text"
                  value={productData.brand || ''}
                  onChange={(e) => updateProductField('brand', e.target.value)}
                  placeholder="Enter brand name"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>

              {/* Product Name */}
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--foreground)' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={productData.product_name || ''}
                  onChange={(e) => updateProductField('product_name', e.target.value)}
                  placeholder="Product name"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>

              {/* Size */}
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--foreground)' }}>
                  Size
                </label>
                <input
                  type="text"
                  value={productData.size || ''}
                  onChange={(e) => updateProductField('size', e.target.value)}
                  placeholder="e.g., M, 42, 10x12"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>

              {/* Price */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--foreground)' }}>
                    Price
                  </label>
                  <input
                    type="number"
                    value={productData.price || ''}
                    onChange={(e) => updateProductField('price', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--background-secondary)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>
                <div className="w-24">
                  <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--foreground)' }}>
                    Currency
                  </label>
                  <select
                    value={productData.currency || 'USD'}
                    onChange={(e) => updateProductField('currency', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={{
                      backgroundColor: 'var(--background-secondary)',
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
                <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--foreground)' }}>
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {(productData.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                      style={{
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                      }}
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:opacity-70 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Collection Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--foreground)' }}>
                  Save to Collection
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {collections.map((collection) => (
                    <label
                      key={collection.id}
                      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
                      style={{
                        backgroundColor: selectedCollections.includes(collection.id)
                          ? 'var(--primary-alpha)'
                          : 'transparent',
                      }}
                    >
                      <input
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
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--background-secondary)',
                        border: '1px solid var(--border)',
                        color: 'var(--foreground)',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateCollection();
                        }
                      }}
                    />
                    <button
                      onClick={handleCreateCollection}
                      className="p-2 rounded-lg transition-colors cursor-pointer"
                      style={{
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                      }}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-lg font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || selectedCollections.length === 0}
                  className="flex-1 py-3 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                  }}
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save Product'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
