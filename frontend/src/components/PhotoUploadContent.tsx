'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Loader2, Check, AlertCircle, Plus, X } from 'lucide-react';
import { useUploadStore, ProductType, SimilarProduct } from '@/stores/useUploadStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { Button, IconButton, Input, CurrencySelect, Checkbox, TagList, useSidePanel } from '@/components/ui';
import MultiProductSelectionGrid from './MultiProductSelectionGrid';
import { SimilarProductMatch } from './SimilarProductMatch';

/**
 * Photo upload form content - used inside SidePanel
 * This is the content portion only, header is handled by SidePanel
 */
export default function PhotoUploadContent() {
  const { close } = useSidePanel();

  const {
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
    // Multi-product state
    detectionMode,
    detectedProducts,
    selectedProductIds,
    originalImageUrl,
    processedProducts,
    toggleProductSelection,
    selectAllProducts,
    deselectAllProducts,
    updateDetectedProductName,
    updateProcessedProduct,
    clearError,
    reset,
    // Similarity state
    similarProducts,
    showSimilarityUI,
    setProductData,
  } = useUploadStore();

  const { collections, createCollection } = useCollectionsStore();
  const {
    uploadAndProcess,
    saveToCollections,
    smartDetectAndProcess,
    processSelectedProductsFromDetection,
    saveMultipleToCollections,
    // Similarity functions
    findSimilarProducts,
    generateEmbedding,
    dismissSimilarity,
  } = usePhotoUpload();

  // Track if similarity check is in progress
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);

  // Track which product is expanded in multi-edit mode
  const [expandedProductIndex, setExpandedProductIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const newCollectionInputRef = useRef<HTMLInputElement>(null);

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
      // Generate embedding in background (non-blocking)
      if (productData?.image_url && productData?.id) {
        generateEmbedding(productData.image_url, productData.id, {
          productName: productData.product_name,
          brand: productData.brand,
          category: productData.category,
          tags: productData.tags,
          colors: productData.color_palette,
          material: productData.material,
          size: productData.size,
          price: productData.price,
        });
      }
      setTimeout(() => {
        reset();
        close();
      }, 1000);
    }
  }, [saveToCollections, reset, close, productData, generateEmbedding]);

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

  // Smart detection handler - always runs smart detection first, then checks for similar products
  const handleSmartDetect = useCallback(async () => {
    if (!selectedFile) return;

    const result = await smartDetectAndProcess();

    // If we got a single product with an image, check for similar products in closet
    if (result && result.mode === 'single' && result.products.length === 1) {
      // Get the original image URL from the detection result
      const imageUrl = originalImageUrl;
      if (imageUrl) {
        setCheckingSimilarity(true);
        await findSimilarProducts(imageUrl);
        setCheckingSimilarity(false);
      }
    }
  }, [selectedFile, smartDetectAndProcess, originalImageUrl, findSimilarProducts]);

  const handleProcessSelected = useCallback(async () => {
    await processSelectedProductsFromDetection();
  }, [processSelectedProductsFromDetection]);

  const handleSaveMultiple = useCallback(async () => {
    const success = await saveMultipleToCollections();
    if (success) {
      // Generate embeddings for all products in background (non-blocking)
      for (const product of processedProducts) {
        if (product?.image_url && product?.id) {
          generateEmbedding(product.image_url, product.id, {
            productName: product.product_name,
            brand: product.brand,
            category: product.category,
            tags: product.tags,
            colors: product.color_palette,
            material: product.material,
            size: product.size,
            price: product.price,
          });
        }
      }
      setTimeout(() => {
        reset();
        close();
      }, 1000);
    }
  }, [saveMultipleToCollections, reset, close, processedProducts, generateEmbedding]);

  const handleCancel = useCallback(() => {
    reset();
    close();
  }, [reset, close]);

  // Similarity handlers
  const handleUseExistingProduct = useCallback((similarProduct: SimilarProduct) => {
    // Copy metadata from the similar product to the current product
    if (productData) {
      setProductData({
        ...productData,
        brand: similarProduct.brand || productData.brand,
        category: similarProduct.category || productData.category,
        tags: similarProduct.tags || productData.tags,
        color_palette: similarProduct.colors || productData.color_palette,
      });
    }
    dismissSimilarity();
  }, [productData, setProductData, dismissSimilarity]);

  const handleAddAsNew = useCallback(() => {
    // Just dismiss the similarity UI and continue with the current product data
    dismissSimilarity();
  }, [dismissSimilarity]);

  const isProcessing = status === 'uploading' || status === 'processing';
  const canEdit = status === 'editing' || status === 'error';
  const isSaving = status === 'saving';
  const isSuccess = status === 'success';

  // Multi-product states
  const isDetecting = status === 'detecting';
  const isSelecting = status === 'selecting';
  const isProcessingMulti = status === 'processing-multi';
  const isEditingMulti = status === 'editing-multi';
  const isAnyMultiState = isDetecting || isSelecting || isProcessingMulti || isEditingMulti;

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
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
              <IconButton
                icon={X}
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                aria-label="Remove selected image"
                className="absolute top-2 right-2"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
              />
            )}
            {(isProcessing || isDetecting || isProcessingMulti) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <Loader2 size={32} className="animate-spin mb-2" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                <p className="text-sm text-white">
                  {status === 'uploading' && 'Uploading...'}
                  {status === 'processing' && 'Processing...'}
                  {status === 'detecting' && 'Detecting products...'}
                  {status === 'processing-multi' && 'Processing selected products...'}
                </p>
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
        <div className="flex items-center justify-between gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--error)', color: 'white' }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={18} aria-hidden="true" />
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-sm font-medium px-3 py-1 rounded hover:bg-white/20 transition-colors"
          >
            Retry
          </button>
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
      {!canEdit && !isProcessing && !isSuccess && !isAnyMultiState && selectedFile && (
        <div>
          <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--foreground)' }}>
            Product Type
          </label>
          <div className="flex gap-2">
            {(['fashion', 'home'] as ProductType[]).map((type) => (
              <Button
                key={type}
                variant={productType === type ? 'primary' : 'secondary'}
                onClick={() => setProductType(type)}
                className="flex-1"
              >
                {type === 'fashion' ? 'Fashion' : 'Home'}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Smart Detect Button - Always runs smart detection */}
      {!canEdit && !isProcessing && !isSuccess && !isAnyMultiState && selectedFile && (
        <Button
          className="w-full"
          onClick={handleSmartDetect}
        >
          Detect & Process
        </Button>
      )}

      {/* Detection Results - shows different UI based on detectionMode */}
      {isSelecting && originalImageUrl && (
        <div className="space-y-3">
          {/* Mode indicator */}
          {detectionMode === 'single' && detectedProducts.length === 1 && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--success-alpha)', color: 'var(--success)' }}>
              Found 1 item with high confidence
            </div>
          )}
          {detectionMode === 'uncertain' && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--warning-alpha)', color: 'var(--warning)' }}>
              Found 1 item. There might be more items in this image.
            </div>
          )}
          {detectionMode === 'multi' && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--primary-alpha)', color: 'var(--primary)' }}>
              Found {detectedProducts.length} items - select which ones to add
            </div>
          )}

          <MultiProductSelectionGrid
            products={detectedProducts}
            selectedIds={selectedProductIds}
            originalImageUrl={originalImageUrl}
            onToggle={toggleProductSelection}
            onSelectAll={selectAllProducts}
            onDeselectAll={deselectAllProducts}
            onUpdateName={updateDetectedProductName}
          />
          <Button
            className="w-full"
            onClick={handleProcessSelected}
            disabled={selectedProductIds.size === 0}
          >
            {detectionMode === 'single'
              ? 'Continue with this item'
              : `Process Selected (${selectedProductIds.size})`}
          </Button>
        </div>
      )}

      {/* Similar Product Match UI */}
      {showSimilarityUI && originalImageUrl && (
        <SimilarProductMatch
          uploadedImageUrl={originalImageUrl}
          onUseExisting={handleUseExistingProduct}
          onAddAsNew={handleAddAsNew}
        />
      )}

      {/* Similarity check loading indicator */}
      {checkingSimilarity && (
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-light)' }}>
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--primary)' }} />
          <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Checking for similar items in your closet...
          </span>
        </div>
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
            <CurrencySelect
              label="Currency"
              value={productData.currency || 'USD'}
              onChange={(value) => updateProductField('currency', value)}
              className="w-28"
              fullWidth={false}
            />
          </div>

          {/* AI Tags */}
          <TagList
            label="Tags"
            tags={productData.tags || []}
            onRemove={handleRemoveTag}
          />

          {/* Collection Selection */}
          <div>
            <span className="text-sm font-medium mb-2 block" style={{ color: 'var(--foreground)' }}>
              Save to Collection
            </span>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: selectedCollections.includes(collection.id) ? 'var(--primary-alpha)' : 'transparent',
                  }}
                >
                  <Checkbox
                    id={`collection-${collection.id}`}
                    checked={selectedCollections.includes(collection.id)}
                    onChange={() => toggleCollection(collection.id)}
                    label={collection.name}
                    helperText={`${collection.products.length} items`}
                    size="sm"
                  />
                </div>
              ))}

              {/* New Collection Input */}
              <div className="flex items-center gap-2 pt-2">
                <Input
                  ref={newCollectionInputRef}
                  placeholder="New collection name..."
                  className="flex-1"
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
            <Button variant="outline" className="flex-1" onClick={handleCancel}>
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

      {/* Multi-Product Editing */}
      {isEditingMulti && processedProducts.length > 0 && (
        <div className="space-y-4">
          {/* Product Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2">
            {processedProducts.map((product, index) => (
              <button
                key={product.id || index}
                onClick={() => setExpandedProductIndex(index)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: expandedProductIndex === index ? 'var(--primary)' : 'var(--surface-light)',
                  color: expandedProductIndex === index ? 'white' : 'var(--foreground)',
                }}
              >
                {product.product_name || `Product ${index + 1}`}
              </button>
            ))}
          </div>

          {/* Current Product Editor */}
          {processedProducts[expandedProductIndex] && (
            <div className="space-y-3">
              {/* Product Image Preview */}
              <div className="flex gap-3">
                <div
                  className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0"
                  style={{ backgroundColor: 'var(--background-secondary)' }}
                >
                  {processedProducts[expandedProductIndex].image_url && (
                    <img
                      src={processedProducts[expandedProductIndex].image_url}
                      alt={processedProducts[expandedProductIndex].product_name || ''}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    label="Name"
                    value={processedProducts[expandedProductIndex].product_name || ''}
                    onChange={(e) => updateProcessedProduct(expandedProductIndex, { product_name: e.target.value })}
                    placeholder="Product name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Brand"
                  value={processedProducts[expandedProductIndex].brand || ''}
                  onChange={(e) => updateProcessedProduct(expandedProductIndex, { brand: e.target.value })}
                  placeholder="Brand"
                />
                <Input
                  label="Price"
                  type="number"
                  value={processedProducts[expandedProductIndex].price || ''}
                  onChange={(e) => updateProcessedProduct(expandedProductIndex, { price: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              {/* Tags */}
              <TagList
                label="Tags"
                tags={(processedProducts[expandedProductIndex].tags || []) as string[]}
                size="sm"
              />
            </div>
          )}

          {/* Collection Selection */}
          <div>
            <span className="text-sm font-medium mb-2 block" style={{ color: 'var(--foreground)' }}>
              Save All to Collection
            </span>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: selectedCollections.includes(collection.id) ? 'var(--primary-alpha)' : 'transparent',
                  }}
                >
                  <Checkbox
                    id={`multi-collection-${collection.id}`}
                    checked={selectedCollections.includes(collection.id)}
                    onChange={() => toggleCollection(collection.id)}
                    label={collection.name}
                    helperText={`${collection.products.length} items`}
                    size="sm"
                  />
                </div>
              ))}

              {/* New Collection Input */}
              <div className="flex items-center gap-2 pt-2">
                <Input
                  ref={newCollectionInputRef}
                  placeholder="New collection name..."
                  className="flex-1"
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
            <Button variant="outline" className="flex-1" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveMultiple}
              disabled={isSaving || selectedCollections.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                `Save All (${processedProducts.length})`
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
