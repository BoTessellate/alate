import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Collection, Product, CollectionMetadata } from '@/types';

interface CollectionsState {
  collections: Collection[];
  createCollection: (name: string, description?: string) => Collection;
  deleteCollection: (id: string) => void;
  renameCollection: (id: string, name: string) => void;
  updateCollectionDescription: (id: string, description: string) => void;
  addProductToCollection: (collectionId: string, product: Product) => void;
  removeProductFromCollection: (collectionId: string, productId: string) => void;
  getCollectionById: (id: string) => Collection | undefined;
  getCollectionMetadata: (id: string) => CollectionMetadata | null;
  getAggregatedMetadata: (collectionIds: string[]) => CollectionMetadata;
  isProductInCollection: (collectionId: string, productId: string) => boolean;
  isProductInAnyCollection: (productId: string) => string[];
}

export const useCollectionsStore = create<CollectionsState>()(
  persist(
    (set, get) => ({
      collections: [],

      createCollection: (name, description) => {
        const id = `col-${Date.now()}`;
        const now = new Date().toISOString();

        const newCollection: Collection = {
          id,
          name: name.trim() || 'Untitled Collection',
          description,
          products: [],
          coverImages: [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          collections: [newCollection, ...state.collections],
        }));

        return newCollection;
      },

      deleteCollection: (id) => {
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
        }));
      },

      renameCollection: (id, name) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === id ? { ...c, name, updatedAt: new Date().toISOString() } : c
          ),
        }));
      },

      updateCollectionDescription: (id, description) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === id ? { ...c, description, updatedAt: new Date().toISOString() } : c
          ),
        }));
      },

      addProductToCollection: (collectionId, product) => {
        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id !== collectionId) return c;

            // Check if product already exists
            if (c.products.some((p) => p.id === product.id)) return c;

            const updatedProducts = [...c.products, product];
            const coverImages = updatedProducts
              .slice(0, 4)
              .map((p) => p.image_url)
              .filter(Boolean);

            return {
              ...c,
              products: updatedProducts,
              coverImages,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      removeProductFromCollection: (collectionId, productId) => {
        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id !== collectionId) return c;

            const updatedProducts = c.products.filter((p) => p.id !== productId);
            const coverImages = updatedProducts
              .slice(0, 4)
              .map((p) => p.image_url)
              .filter(Boolean);

            return {
              ...c,
              products: updatedProducts,
              coverImages,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      getCollectionById: (id) => {
        return get().collections.find((c) => c.id === id);
      },

      getCollectionMetadata: (id) => {
        const collection = get().getCollectionById(id);
        if (!collection) return null;

        return get().getAggregatedMetadata([id]);
      },

      getAggregatedMetadata: (collectionIds) => {
        const collections = get().collections.filter((c) => collectionIds.includes(c.id));

        const allProducts = collections.flatMap((c) => c.products);

        return {
          tags: [...new Set(allProducts.flatMap((p) => p.tags || []))],
          colors: [...new Set(allProducts.flatMap((p) => p.color_palette || []))],
          materials: [...new Set(allProducts.map((p) => p.material).filter((m): m is string => Boolean(m)))],
          textures: [...new Set(allProducts.map((p) => p.texture).filter((t): t is string => Boolean(t)))],
          tones: [...new Set(allProducts.map((p) => p.tone).filter((t): t is string => Boolean(t)))],
          categories: [...new Set(allProducts.map((p) => p.category).filter(Boolean))],
        };
      },

      isProductInCollection: (collectionId, productId) => {
        const collection = get().getCollectionById(collectionId);
        return collection?.products.some((p) => p.id === productId) || false;
      },

      isProductInAnyCollection: (productId) => {
        return get()
          .collections.filter((c) => c.products.some((p) => p.id === productId))
          .map((c) => c.id);
      },
    }),
    {
      name: 'tml-collections-storage',
    }
  )
);
