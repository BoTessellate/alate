import { create } from 'zustand';
import type { Product } from '@/types';

export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'editing'
  | 'saving'
  | 'success'
  | 'error';

export type ProductType = 'fashion' | 'home';

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

  // Product data (from AI + user edits)
  productData: Partial<Product> | null;
  selectedCollections: string[];

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
  selectedCollections: [],
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
    set({ ...initialState });
  },
}));
