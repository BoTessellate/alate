import { useCallback } from 'react';
import { useUploadStore, DetectedProduct } from '@/stores/useUploadStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import type { Product } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-tml.vercel.app';

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
  } = useUploadStore();

  const { addProductToCollection } = useCollectionsStore();

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

      // Call the API
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
      // Provide action-based error messages
      let message = 'Upload failed';

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        if (errorMsg.includes('failed to fetch') || errorMsg.includes('networkerror') || errorMsg.includes('network')) {
          message = 'Unable to connect to server. Check your internet connection and try again.';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('aborted')) {
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
  }, [selectedFile, productType, fileToBase64, setStatus, setProgress, setError, setProductData]);

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

      // Call the multi-detection API
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
      let message = 'Detection failed';
      if (error instanceof Error) {
        message = error.message || 'Failed to detect products. Please try again.';
      }
      setError(message);
      return null;
    }
  }, [selectedFile, productType, fileToBase64, setStatus, setProgress, setError, setDetectedProducts]);

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

  return {
    uploadAndProcess,
    saveToCollections,
    resetUpload,
    // Multi-product functions
    detectProducts,
    processSelectedProductsFromDetection,
    saveMultipleToCollections,
  };
}
