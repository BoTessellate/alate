/**
 * Moodboard Store - Zustand State Management
 * Manages moodboard state and operations
 */

import { create } from 'zustand';
import { Moodboard, MoodboardProduct, Product, Position, Size } from '../types';
import api from '../services/api';

interface MoodboardState {
  // State
  moodboards: Moodboard[];
  currentMoodboard: Moodboard | null;
  selectedProductId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchMoodboards: () => Promise<void>;
  fetchMoodboard: (id: string) => Promise<void>;
  createMoodboard: (name: string, description?: string) => Promise<Moodboard>;
  updateMoodboard: (id: string, updates: Partial<Moodboard>) => Promise<void>;
  deleteMoodboard: (id: string) => Promise<void>;

  // Product operations
  addProduct: (product: Product, position?: Position, size?: Size) => void;
  removeProduct: (productId: string) => void;
  updateProductPosition: (productId: string, position: Position) => void;
  updateProductSize: (productId: string, size: Size) => void;
  selectProduct: (productId: string | null) => void;

  // Canvas operations
  setCanvasSize: (width: number, height: number) => void;
  clearCanvas: () => void;

  // Error handling
  clearError: () => void;
}

export const useMoodboardStore = create<MoodboardState>((set, get) => ({
  // Initial state
  moodboards: [],
  currentMoodboard: null,
  selectedProductId: null,
  isLoading: false,
  error: null,

  // Fetch all moodboards
  fetchMoodboards: async () => {
    set({ isLoading: true, error: null });
    try {
      const moodboards = await api.getMoodboards();
      set({ moodboards, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch moodboards',
        isLoading: false,
      });
    }
  },

  // Fetch single moodboard
  fetchMoodboard: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const moodboard = await api.getMoodboard(id);
      set({ currentMoodboard: moodboard, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch moodboard',
        isLoading: false,
      });
    }
  },

  // Create new moodboard
  createMoodboard: async (name: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const newMoodboard = await api.createMoodboard({
        name,
        description,
        products: [],
        canvas_size: { width: 1200, height: 800 },
      });
      set((state) => ({
        moodboards: [...state.moodboards, newMoodboard],
        currentMoodboard: newMoodboard,
        isLoading: false,
      }));
      return newMoodboard;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create moodboard',
        isLoading: false,
      });
      throw error;
    }
  },

  // Update moodboard
  updateMoodboard: async (id: string, updates: Partial<Moodboard>) => {
    try {
      await api.updateMoodboard(id, updates);
      set((state) => ({
        moodboards: state.moodboards.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
        currentMoodboard:
          state.currentMoodboard?.id === id
            ? { ...state.currentMoodboard, ...updates }
            : state.currentMoodboard,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update moodboard',
      });
    }
  },

  // Delete moodboard
  deleteMoodboard: async (id: string) => {
    try {
      await api.deleteMoodboard(id);
      set((state) => ({
        moodboards: state.moodboards.filter((m) => m.id !== id),
        currentMoodboard:
          state.currentMoodboard?.id === id ? null : state.currentMoodboard,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete moodboard',
      });
    }
  },

  // Add product to current moodboard
  addProduct: (product: Product, position?: Position, size?: Size) => {
    set((state) => {
      if (!state.currentMoodboard) return state;

      const maxZIndex = Math.max(
        0,
        ...state.currentMoodboard.products.map((p) => p.z_index)
      );

      const newProduct: MoodboardProduct = {
        id: `mp_${Date.now()}`,
        product_id: product.id,
        product,
        position: position || { x: 100, y: 100 },
        size: size || { width: 200, height: 200 },
        z_index: maxZIndex + 1,
      };

      return {
        currentMoodboard: {
          ...state.currentMoodboard,
          products: [...state.currentMoodboard.products, newProduct],
        },
      };
    });
  },

  // Remove product from current moodboard
  removeProduct: (productId: string) => {
    set((state) => {
      if (!state.currentMoodboard) return state;

      return {
        currentMoodboard: {
          ...state.currentMoodboard,
          products: state.currentMoodboard.products.filter(
            (p) => p.id !== productId
          ),
        },
        selectedProductId:
          state.selectedProductId === productId ? null : state.selectedProductId,
      };
    });
  },

  // Update product position
  updateProductPosition: (productId: string, position: Position) => {
    set((state) => {
      if (!state.currentMoodboard) return state;

      return {
        currentMoodboard: {
          ...state.currentMoodboard,
          products: state.currentMoodboard.products.map((p) =>
            p.id === productId ? { ...p, position } : p
          ),
        },
      };
    });
  },

  // Update product size
  updateProductSize: (productId: string, size: Size) => {
    set((state) => {
      if (!state.currentMoodboard) return state;

      return {
        currentMoodboard: {
          ...state.currentMoodboard,
          products: state.currentMoodboard.products.map((p) =>
            p.id === productId ? { ...p, size } : p
          ),
        },
      };
    });
  },

  // Select product
  selectProduct: (productId: string | null) => {
    set({ selectedProductId: productId });
  },

  // Set canvas size
  setCanvasSize: (width: number, height: number) => {
    set((state) => {
      if (!state.currentMoodboard) return state;

      return {
        currentMoodboard: {
          ...state.currentMoodboard,
          canvas_size: { width, height },
        },
      };
    });
  },

  // Clear canvas
  clearCanvas: () => {
    set((state) => {
      if (!state.currentMoodboard) return state;

      return {
        currentMoodboard: {
          ...state.currentMoodboard,
          products: [],
        },
        selectedProductId: null,
      };
    });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));

export default useMoodboardStore;
