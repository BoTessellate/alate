import { useCallback, useRef, useEffect } from 'react';
import { useUploadStore, DetectedProduct, DetectionMode, SimilarProduct } from '@/stores/useUploadStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import type { Product } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-tml.vercel.app';

/**
 * Check if an error is an abort error (request was cancelled)
 */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Get or generate a device ID for per-user namespacing.
 * Used for isolating user embeddings in Pinecone.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';

  let deviceId = localStorage.getItem('tml-device-id');
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('tml-device-id', deviceId);
  }
  return deviceId;
}

// Similarity search response type
interface FindSimilarResponse {
  success: boolean;
  similar_products: SimilarProduct[];
  vision_description?: string;
  error?: string;
}

// Embed response type
interface EmbedResponse {
  success: boolean;
  embedding_id?: string;
  vision_description?: string;
  error?: string;
}

// Smart detection response type
interface SmartDetectResponse {
  success: boolean;
  recommendedMode: 'single' | 'multi' | 'uncertain';
  detectedProducts: DetectedProduct[];
  originalImageUrl: string;
  processingTimeMs: number;
  _demo?: boolean;
}

// Multi-product detection response types
interface MultiDetectionResponse {
  success: boolean;
  originalImageUrl: string;
  detectedProducts: DetectedProduct[];
  processingTimeMs: number;
  _demo?: boolean;
}

interface ProcessMultiResponse {
  success: boolean;
  products: Array<{
    id: string;
    original_image_url: string;
    image_url: string;
    product_name: string;
    brand: string;
    price: number;
    currency: string;
    tags: string[];
    color_palette: string[];
    category: string;
    material?: string;
    texture?: string;
    tone?: string;
    source: 'upload';
    uploaded_at: string;
  }>;
  totalProcessingMs: number;
  _demo?: boolean;
}

interface PhotoUploadResponse {
  success: boolean;
  product: {
    id: string;
    original_image_url: string;
    image_url: string;
    product_name: string;
    brand: string;
    price: number;
    currency: string;
    tags: string[];
    color_palette: string[];
    category: string;
    material?: string;
    texture?: string;
    tone?: string;
    source: 'upload';
    uploaded_at: string;
  };
  processingTime: {
    uploadMs: number;
    backgroundRemovalMs: number;
    enrichmentMs: number;
    totalMs: number;
  };
  _demo?: boolean;
}

interface PhotoUploadErrorResponse {
  success: false;
  error: string;
  code: string;
}

/**
 * Hook for handling photo upload and processing
 */
export function usePhotoUpload() {
  const {
    selectedFile,
    productType,
    productData,
    selectedCollections,
    setStatus,
    setProgress,
    setError,
    setProductData,
    reset,
    // Multi-product state
    detectedProducts,
    selectedProductIds,
    processedProducts,
    setDetectedProducts,
    setProcessedProducts,
    setDetectionMode,
    // Similarity state
    setSimilarProducts,
    setShowSimilarityUI,
    clearSimilarProducts,
  } = useUploadStore();

  const { addProductToCollection } = useCollectionsStore();

  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount - cancel any pending requests
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Cancel any in-flight requests
   */
  const cancelRequests = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Create a new AbortController for a request
   */
  const createAbortController = useCallback(() => {
    // Cancel any existing request
    cancelRequests();
    // Create new controller
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, [cancelRequests]);

  /**
   * Convert File to base64
   */
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * Upload and process the selected file
   */
  const uploadAndProcess = useCallback(async () => {
    if (!selectedFile) {
      setError('No file selected');
      return null;
    }

    // Create abort signal for this request
    const signal = createAbortController();

    try {
      setStatus('uploading');
      setProgress(10);

      // Convert file to base64
      const base64 = await fileToBase64(selectedFile);
      setProgress(20);

      // Determine MIME type
      const mimeType = selectedFile.type as 'image/jpeg' | 'image/png' | 'image/webp';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        throw new Error('Invalid file format. Please upload JPG, PNG, or WebP.');
      }

      setStatus('processing');
      setProgress(30);

      // Call the API with abort signal
      const response = await fetch(`${API_BASE_URL}/api/image-processing?action=upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: {
            base64,
            mimeType,
            fileName: selectedFile.name,
          },
          productType,
        }),
        signal,
      });

      setProgress(70);

      if (!response.ok) {
        const errorData: PhotoUploadErrorResponse = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data: PhotoUploadResponse = await response.json();
      setProgress(90);

      if (!data.success) {
        throw new Error('Processing failed');
      }

      // Set the product data for editing
      const product: Partial<Product> = {
        id: data.product.id,
        product_name: data.product.product_name,
        brand: data.product.brand,
        price: data.product.price,
        currency: data.product.currency,
        image_url: data.product.image_url,
        original_image_url: data.product.original_image_url,
        tags: data.product.tags,
        color_palette: data.product.color_palette,
        category: data.product.category,
        material: data.product.material,
        texture: data.product.texture,
        tone: data.product.tone,
        source: 'upload',
        uploaded_at: data.product.uploaded_at,
      };

      setProductData(product);
      setProgress(100);
      setStatus('editing');

      return product;
    } catch (error) {
      // Ignore abort errors - user cancelled the request
      if (isAbortError(error)) {
        return null;
      }

      // Provide action-based error messages
      let message = 'Upload failed';

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        if (errorMsg.includes('failed to fetch') || errorMsg.includes('networkerror') || errorMsg.includes('network')) {
          message = 'Unable to connect to server. Check your internet connection and try again.';
        } else if (errorMsg.includes('timeout')) {
          message = 'Request timed out. Please try again with a smaller image.';
        } else if (errorMsg.includes('invalid file') || errorMsg.includes('format')) {
          message = error.message; // Keep validation errors as-is
        } else if (errorMsg.includes('413') || errorMsg.includes('too large')) {
          message = 'Image is too large. Please use an image under 10MB.';
        } else if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
          message = 'Authentication error. Please refresh the page and try again.';
        } else if (errorMsg.includes('500') || errorMsg.includes('server')) {
          message = 'Server error while processing image. Please try again later.';
        } else {
          message = error.message || 'Failed to process image. Please try again.';
        }
      }

      setError(message);
      return null;
    }
  }, [selectedFile, productType, fileToBase64, setStatus, setProgress, setError, setProductData, createAbortController]);

  /**
   * Save the product to selected collections
   */
  const saveToCollections = useCallback(async () => {
    if (!productData || !productData.id) {
      setError('No product data to save');
      return false;
    }

    if (selectedCollections.length === 0) {
      setError('Please select at least one collection');
      return false;
    }

    try {
      setStatus('saving');

      // Ensure all required fields have values
      const product: Product = {
        id: productData.id,
        product_name: productData.product_name || 'Uploaded Product',
        brand: productData.brand || 'My Upload',
        price: productData.price || 0,
        currency: productData.currency || 'USD',
        image_url: productData.image_url || '',
        tags: productData.tags || [],
        color_palette: productData.color_palette || [],
        category: productData.category || 'general',
        material: productData.material,
        texture: productData.texture,
        tone: productData.tone,
        size: productData.size,
        source: 'upload',
        original_image_url: productData.original_image_url,
        uploaded_at: productData.uploaded_at,
      };

      // Add to each selected collection
      for (const collectionId of selectedCollections) {
        addProductToCollection(collectionId, product);
      }

      setStatus('success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save product. Please try again.';
      setError(message);
      return false;
    }
  }, [productData, selectedCollections, addProductToCollection, setStatus, setError]);

  /**
   * Reset the upload state
   */
  const resetUpload = useCallback(() => {
    reset();
  }, [reset]);

  /**
   * Detect multiple products in the selected image
   */
  const detectProducts = useCallback(async () => {
    if (!selectedFile) {
      setError('No file selected');
      return null;
    }

    // Create abort signal for this request
    const signal = createAbortController();

    try {
      setStatus('detecting');
      setProgress(10);

      // Convert file to base64
      const base64 = await fileToBase64(selectedFile);
      setProgress(30);

      // Determine MIME type
      const mimeType = selectedFile.type as 'image/jpeg' | 'image/png' | 'image/webp';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        throw new Error('Invalid file format. Please upload JPG, PNG, or WebP.');
      }

      setProgress(50);

      // Call the multi-detection API with abort signal
      const response = await fetch(`${API_BASE_URL}/api/image-processing?action=detect-multi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: {
            base64,
            mimeType,
          },
          context: productType,
        }),
        signal,
      });

      setProgress(80);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Detection failed');
      }

      const data: MultiDetectionResponse = await response.json();
      setProgress(100);

      if (!data.success || data.detectedProducts.length === 0) {
        setError('No products detected in this image. Try single product mode.');
        setStatus('idle');
        return null;
      }

      // Store detected products
      setDetectedProducts(data.detectedProducts, data.originalImageUrl);
      setStatus('selecting');

      return data.detectedProducts;
    } catch (error) {
      // Ignore abort errors - user cancelled the request
      if (isAbortError(error)) {
        return null;
      }

      let message = 'Detection failed';
      if (error instanceof Error) {
        message = error.message || 'Failed to detect products. Please try again.';
      }
      setError(message);
      return null;
    }
  }, [selectedFile, productType, fileToBase64, setStatus, setProgress, setError, setDetectedProducts, createAbortController]);

  /**
   * Smart detect: Always runs multi-product detection and determines the best mode
   * Returns the recommended mode and detected products
   */
  const smartDetectAndProcess = useCallback(async (): Promise<{
    mode: DetectionMode;
    products: DetectedProduct[];
  } | null> => {
    if (!selectedFile) {
      setError('No file selected');
      return null;
    }

    try {
      setStatus('detecting');
      setProgress(10);

      // Convert file to base64
      const base64 = await fileToBase64(selectedFile);
      setProgress(30);

      // Determine MIME type
      const mimeType = selectedFile.type as 'image/jpeg' | 'image/png' | 'image/webp';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        throw new Error('Invalid file format. Please upload JPG, PNG, or WebP.');
      }

      setProgress(50);

      // Call the smart-detect API
      const response = await fetch(`${API_BASE_URL}/api/image-processing?action=smart-detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: {
            base64,
            mimeType,
          },
          context: productType,
        }),
      });

      setProgress(80);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Detection failed');
      }

      const data: SmartDetectResponse = await response.json();
      setProgress(100);

      // Store detected products with the recommended mode
      const mode = data.recommendedMode as DetectionMode;
      setDetectionMode(mode);

      if (data.detectedProducts.length > 0) {
        setDetectedProducts(data.detectedProducts, data.originalImageUrl, mode);
      }

      // Set appropriate status based on mode
      if (mode === 'single') {
        // For single confident product, could auto-process or go to selecting
        // For now, let's show the single product for confirmation
        if (data.detectedProducts.length === 1) {
          setStatus('selecting');
        } else {
          // No products detected, fallback to single upload mode
          setStatus('idle');
        }
      } else if (mode === 'multi') {
        // Multiple products detected - show selection UI
        setStatus('selecting');
      } else if (mode === 'uncertain') {
        // Single product with low confidence - show with option to look for more
        setStatus('selecting');
      }

      return {
        mode,
        products: data.detectedProducts,
      };
    } catch (error) {
      let message = 'Detection failed';
      if (error instanceof Error) {
        message = error.message || 'Failed to detect products. Please try again.';
      }
      setError(message);
      return null;
    }
  }, [selectedFile, productType, fileToBase64, setStatus, setProgress, setError, setDetectedProducts, setDetectionMode]);

  /**
   * Process selected products from detection
   */
  const processSelectedProductsFromDetection = useCallback(async () => {
    if (!selectedFile || selectedProductIds.size === 0) {
      setError('No products selected');
      return null;
    }

    try {
      setStatus('processing-multi');
      setProgress(10);

      // Convert file to base64
      const base64 = await fileToBase64(selectedFile);
      setProgress(20);

      const mimeType = selectedFile.type as 'image/jpeg' | 'image/png' | 'image/webp';

      // Get selected products with their detection data
      const selectedProducts = detectedProducts
        .filter(p => selectedProductIds.has(p.tempId))
        .map(p => ({
          tempId: p.tempId,
          boundingBox: p.boundingBox,
          detected: p,
        }));

      setProgress(30);

      // Call the process-multi API
      const response = await fetch(`${API_BASE_URL}/api/image-processing?action=process-multi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalBase64: base64,
          mimeType,
          selectedProducts,
          productType,
        }),
      });

      setProgress(80);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Processing failed');
      }

      const data: ProcessMultiResponse = await response.json();
      setProgress(100);

      if (!data.success || data.products.length === 0) {
        setError('Failed to process products. Please try again.');
        return null;
      }

      // Convert to Partial<Product>[] for editing
      const products: Partial<Product>[] = data.products.map(p => ({
        id: p.id,
        product_name: p.product_name,
        brand: p.brand,
        price: p.price,
        currency: p.currency,
        image_url: p.image_url,
        original_image_url: p.original_image_url,
        tags: p.tags,
        color_palette: p.color_palette,
        category: p.category,
        material: p.material,
        texture: p.texture,
        tone: p.tone,
        source: 'upload',
        uploaded_at: p.uploaded_at,
      }));

      setProcessedProducts(products);
      setStatus('editing-multi');

      return products;
    } catch (error) {
      let message = 'Processing failed';
      if (error instanceof Error) {
        message = error.message || 'Failed to process products. Please try again.';
      }
      setError(message);
      return null;
    }
  }, [selectedFile, selectedProductIds, detectedProducts, productType, fileToBase64, setStatus, setProgress, setError, setProcessedProducts]);

  /**
   * Save all processed products to collections
   */
  const saveMultipleToCollections = useCallback(async () => {
    if (processedProducts.length === 0) {
      setError('No products to save');
      return false;
    }

    if (selectedCollections.length === 0) {
      setError('Please select at least one collection');
      return false;
    }

    try {
      setStatus('saving');

      // Save each product to selected collections
      for (const productData of processedProducts) {
        const product: Product = {
          id: productData.id || crypto.randomUUID(),
          product_name: productData.product_name || 'Uploaded Product',
          brand: productData.brand || 'My Upload',
          price: productData.price || 0,
          currency: productData.currency || 'USD',
          image_url: productData.image_url || '',
          tags: productData.tags || [],
          color_palette: productData.color_palette || [],
          category: productData.category || 'general',
          material: productData.material,
          texture: productData.texture,
          tone: productData.tone,
          size: productData.size,
          source: 'upload',
          original_image_url: productData.original_image_url,
          uploaded_at: productData.uploaded_at,
        };

        for (const collectionId of selectedCollections) {
          addProductToCollection(collectionId, product);
        }
      }

      setStatus('success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save products.';
      setError(message);
      return false;
    }
  }, [processedProducts, selectedCollections, addProductToCollection, setStatus, setError]);

  /**
   * Find similar products in user's closet based on image URL
   * Returns true if similar products were found and UI should be shown
   */
  const findSimilarProducts = useCallback(async (imageUrl: string, threshold = 0.75): Promise<boolean> => {
    const deviceId = getDeviceId();

    try {
      const response = await fetch(`${API_BASE_URL}/api/image-embedding?action=find-similar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          device_id: deviceId,
          threshold,
          limit: 5,
        }),
      });

      if (!response.ok) {
        console.warn('[usePhotoUpload] Similarity search failed:', response.status);
        return false;
      }

      const data: FindSimilarResponse = await response.json();

      if (data.success && data.similar_products.length > 0) {
        setSimilarProducts(data.similar_products);
        setShowSimilarityUI(true);
        return true;
      }

      return false;
    } catch (error) {
      console.warn('[usePhotoUpload] Similarity search error:', error);
      return false;
    }
  }, [setSimilarProducts, setShowSimilarityUI]);

  /**
   * Generate and store embedding for a product (call after saving to closet)
   * This runs in background and doesn't block the UI
   */
  const generateEmbedding = useCallback(async (
    imageUrl: string,
    productId: string,
    metadata?: {
      productName?: string;
      brand?: string;
      category?: string;
      tags?: string[];
      colors?: string[];
      material?: string;
      size?: string;
      price?: number;
    }
  ): Promise<void> => {
    const deviceId = getDeviceId();

    try {
      const response = await fetch(`${API_BASE_URL}/api/image-embedding?action=embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          product_id: productId,
          device_id: deviceId,
          metadata: metadata ? {
            product_name: metadata.productName,
            brand: metadata.brand,
            category: metadata.category,
            tags: metadata.tags,
            colors: metadata.colors,
            material: metadata.material,
            size: metadata.size,
            price: metadata.price,
          } : undefined,
        }),
      });

      if (!response.ok) {
        console.warn('[usePhotoUpload] Embedding generation failed:', response.status);
        return;
      }

      const data: EmbedResponse = await response.json();

      if (data.success) {
        console.log('[usePhotoUpload] Embedding stored:', data.embedding_id);
      } else {
        console.warn('[usePhotoUpload] Embedding generation error:', data.error);
      }
    } catch (error) {
      console.warn('[usePhotoUpload] Embedding generation error:', error);
    }
  }, []);

  /**
   * Clear similarity UI and state
   */
  const dismissSimilarity = useCallback(() => {
    clearSimilarProducts();
  }, [clearSimilarProducts]);

  return {
    uploadAndProcess,
    saveToCollections,
    resetUpload,
    // Multi-product functions
    detectProducts,
    smartDetectAndProcess,
    processSelectedProductsFromDetection,
    saveMultipleToCollections,
    // Similarity functions
    findSimilarProducts,
    generateEmbedding,
    dismissSimilarity,
  };
}
