import { create } from 'zustand';
import type { Product } from '@/types';

export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'editing'
  | 'saving'
  | 'success'
  | 'error'
  // Multi-product detection states
  | 'detecting'
  | 'selecting'
  | 'processing-multi'
  | 'editing-multi';

export type ProductType = 'fashion' | 'home';

// Types for multi-product detection
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedProduct {
  tempId: string;
  boundingBox: BoundingBox;
  suggestedName: string;
  category: string;
  colors: string[];
  confidence: number;
}

interface UploadState {
  // Modal state
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;

  // Upload status
  status: UploadStatus;
  progress: number;
  error: string | null;

  // Image data
  selectedFile: File | null;
  previewUrl: string | null;
  productType: ProductType;

  // Single product data (from AI + user edits)
  productData: Partial<Product> | null;
  selectedCollections: string[];

  // Multi-product detection state
  isMultiMode: boolean;
  detectedProducts: DetectedProduct[];
  selectedProductIds: Set<string>;
  originalImageUrl: string | null;
  processedProducts: Partial<Product>[];

  // Actions
  setFile: (file: File | null) => void;
  setProductType: (type: ProductType) => void;
  setStatus: (status: UploadStatus) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setProductData: (data: Partial<Product> | null) => void;
  updateProductField: <K extends keyof Product>(field: K, value: Product[K]) => void;
  toggleCollection: (collectionId: string) => void;
  setSelectedCollections: (ids: string[]) => void;
  reset: () => void;

  // Multi-product actions
  setMultiMode: (isMulti: boolean) => void;
  setDetectedProducts: (products: DetectedProduct[], originalUrl: string) => void;
  toggleProductSelection: (tempId: string) => void;
  selectAllProducts: () => void;
  deselectAllProducts: () => void;
  updateDetectedProductName: (tempId: string, name: string) => void;
  setProcessedProducts: (products: Partial<Product>[]) => void;
  updateProcessedProduct: (index: number, data: Partial<Product>) => void;
}

const initialState = {
  isModalOpen: false,
  status: 'idle' as UploadStatus,
  progress: 0,
  error: null,
  selectedFile: null,
  previewUrl: null,
  productType: 'fashion' as ProductType,
  productData: null,
  selectedCollections: [] as string[],
  // Multi-product state
  isMultiMode: false,
  detectedProducts: [] as DetectedProduct[],
  selectedProductIds: new Set<string>(),
  originalImageUrl: null as string | null,
  processedProducts: [] as Partial<Product>[],
};

export const useUploadStore = create<UploadState>()((set, get) => ({
  ...initialState,

  openModal: () => set({ isModalOpen: true }),

  closeModal: () => {
    // Clean up preview URL to avoid memory leaks
    const { previewUrl } = get();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    set({ ...initialState });
  },

  setFile: (file) => {
    // Clean up previous preview URL
    const { previewUrl } = get();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (file) {
      const newPreviewUrl = URL.createObjectURL(file);
      set({ selectedFile: file, previewUrl: newPreviewUrl, error: null });
    } else {
      set({ selectedFile: null, previewUrl: null });
    }
  },

  setProductType: (type) => set({ productType: type }),

  setStatus: (status) => set({ status }),

  setProgress: (progress) => set({ progress }),

  setError: (error) => set({ error, status: error ? 'error' : get().status }),

  setProductData: (data) => set({ productData: data }),

  updateProductField: (field, value) => {
    const { productData } = get();
    set({
      productData: {
        ...productData,
        [field]: value,
      },
    });
  },

  toggleCollection: (collectionId) => {
    const { selectedCollections } = get();
    const isSelected = selectedCollections.includes(collectionId);

    if (isSelected) {
      set({ selectedCollections: selectedCollections.filter((id) => id !== collectionId) });
    } else {
      set({ selectedCollections: [...selectedCollections, collectionId] });
    }
  },

  setSelectedCollections: (ids) => set({ selectedCollections: ids }),

  reset: () => {
    const { previewUrl } = get();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    set({ ...initialState, selectedProductIds: new Set<string>() });
  },

  // Multi-product actions
  setMultiMode: (isMulti) => set({ isMultiMode: isMulti }),

  setDetectedProducts: (products, originalUrl) => {
    // Auto-select all detected products
    const selectedIds = new Set(products.map(p => p.tempId));
    set({
      detectedProducts: products,
      selectedProductIds: selectedIds,
      originalImageUrl: originalUrl,
    });
  },

  toggleProductSelection: (tempId) => {
    const { selectedProductIds } = get();
    const newSet = new Set(selectedProductIds);
    if (newSet.has(tempId)) {
      newSet.delete(tempId);
    } else {
      newSet.add(tempId);
    }
    set({ selectedProductIds: newSet });
  },

  selectAllProducts: () => {
    const { detectedProducts } = get();
    const allIds = new Set(detectedProducts.map(p => p.tempId));
    set({ selectedProductIds: allIds });
  },

  deselectAllProducts: () => {
    set({ selectedProductIds: new Set() });
  },

  updateDetectedProductName: (tempId, name) => {
    const { detectedProducts } = get();
    set({
      detectedProducts: detectedProducts.map(p =>
        p.tempId === tempId ? { ...p, suggestedName: name } : p
      ),
    });
  },

  setProcessedProducts: (products) => set({ processedProducts: products }),

  updateProcessedProduct: (index, data) => {
    const { processedProducts } = get();
    const updated = [...processedProducts];
    updated[index] = { ...updated[index], ...data };
    set({ processedProducts: updated });
  },
}));
