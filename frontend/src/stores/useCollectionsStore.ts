import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/useToastStore';
import type { Collection, Product, CollectionMetadata } from '@/types';

// Generate or retrieve a device ID for anonymous users
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';

  let deviceId = localStorage.getItem('tml-device-id');
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('tml-device-id', deviceId);
  }
  return deviceId;
}

// Track sync failures to avoid spamming user with toasts
let syncFailureCount = 0;
const MAX_SILENT_FAILURES = 3;

// Supabase sync helpers
async function syncCollectionToSupabase(collection: Collection, deviceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_collections')
      .upsert({
        id: collection.id,
        device_id: deviceId,
        name: collection.name,
        description: collection.description || null,
        products: collection.products,
        cover_images: collection.coverImages,
        created_at: collection.createdAt,
        updated_at: collection.updatedAt,
      }, { onConflict: 'id' });

    if (error) {
      console.warn('Failed to sync collection to Supabase:', error.message);
      syncFailureCount++;
      // Only show toast after multiple failures to avoid spam
      if (syncFailureCount === MAX_SILENT_FAILURES) {
        toast.warning('Cloud sync unavailable. Your data is saved locally.');
      }
      return false;
    }
    // Reset failure count on success
    syncFailureCount = 0;
    return true;
  } catch (err) {
    console.warn('Supabase sync error:', err);
    syncFailureCount++;
    // Only show toast after multiple failures
    if (syncFailureCount === MAX_SILENT_FAILURES) {
      toast.warning('Cloud sync unavailable. Your data is saved locally.');
    }
    return false;
  }
}

async function deleteCollectionFromSupabase(collectionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_collections')
      .delete()
      .eq('id', collectionId);

    if (error) {
      console.warn('Failed to delete collection from Supabase:', error.message);
      // Silent failure - local deletion already succeeded
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase delete error:', err);
    // Silent failure - local deletion already succeeded
    return false;
  }
}

async function fetchCollectionsFromSupabase(deviceId: string): Promise<{ collections: Collection[]; error: boolean }> {
  try {
    const { data, error } = await supabase
      .from('user_collections')
      .select('*')
      .eq('device_id', deviceId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch collections from Supabase:', error.message);
      return { collections: [], error: true };
    }

    const collections = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      products: row.products || [],
      coverImages: row.cover_images || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    return { collections, error: false };
  } catch (err) {
    console.warn('Supabase fetch error:', err);
    return { collections: [], error: true };
  }
}

interface CollectionsState {
  collections: Collection[];
  isHydrated: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;

  // Core actions
  createCollection: (name: string, description?: string) => Collection;
  deleteCollection: (id: string) => void;
  renameCollection: (id: string, name: string) => void;
  updateCollectionDescription: (id: string, description: string) => void;
  addProductToCollection: (collectionId: string, product: Product) => void;
  removeProductFromCollection: (collectionId: string, productId: string) => void;

  // Query helpers
  getCollectionById: (id: string) => Collection | undefined;
  getCollectionMetadata: (id: string) => CollectionMetadata | null;
  getAggregatedMetadata: (collectionIds: string[]) => CollectionMetadata;
  isProductInCollection: (collectionId: string, productId: string) => boolean;
  isProductInAnyCollection: (productId: string) => string[];

  // Sync actions
  syncWithSupabase: () => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
}

export const useCollectionsStore = create<CollectionsState>()(
  persist(
    (set, get) => ({
      collections: [],
      isHydrated: false,
      isSyncing: false,
      lastSyncedAt: null,

      setHydrated: (hydrated) => set({ isHydrated: hydrated }),

      syncWithSupabase: async () => {
        if (typeof window === 'undefined') return;

        const deviceId = getDeviceId();
        set({ isSyncing: true });

        try {
          // Fetch from Supabase
          const { collections: remoteCollections, error: fetchError } = await fetchCollectionsFromSupabase(deviceId);
          const localCollections = get().collections;

          // Silent failure - just use local data
          if (fetchError) {
            console.warn('Cloud sync unavailable, using local data');
          }

          // Merge strategy: use the most recently updated version of each collection
          const mergedMap = new Map<string, Collection>();

          // Add all local collections
          localCollections.forEach((c) => mergedMap.set(c.id, c));

          // Merge remote collections (prefer more recent)
          remoteCollections.forEach((remote) => {
            const local = mergedMap.get(remote.id);
            if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt)) {
              mergedMap.set(remote.id, remote);
            }
          });

          const merged = Array.from(mergedMap.values())
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          set({
            collections: merged,
            lastSyncedAt: new Date().toISOString(),
            isSyncing: false,
          });

          // Push any local-only or newer local collections to Supabase (if fetch succeeded)
          if (!fetchError) {
            for (const collection of merged) {
              const remote = remoteCollections.find((r) => r.id === collection.id);
              if (!remote || new Date(collection.updatedAt) > new Date(remote.updatedAt)) {
                await syncCollectionToSupabase(collection, deviceId);
              }
            }
          }
        } catch (err) {
          console.warn('Sync with Supabase failed:', err);
          // Silent failure - local data is safe
          set({ isSyncing: false });
        }
      },

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

        // Sync to Supabase in background
        if (typeof window !== 'undefined') {
          syncCollectionToSupabase(newCollection, getDeviceId());
        }

        return newCollection;
      },

      deleteCollection: (id) => {
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
        }));

        // Delete from Supabase in background
        if (typeof window !== 'undefined') {
          deleteCollectionFromSupabase(id);
        }
      },

      renameCollection: (id, name) => {
        let updatedCollection: Collection | undefined;

        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id === id) {
              updatedCollection = { ...c, name, updatedAt: new Date().toISOString() };
              return updatedCollection;
            }
            return c;
          }),
        }));

        // Sync to Supabase
        if (updatedCollection && typeof window !== 'undefined') {
          syncCollectionToSupabase(updatedCollection, getDeviceId());
        }
      },

      updateCollectionDescription: (id, description) => {
        let updatedCollection: Collection | undefined;

        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id === id) {
              updatedCollection = { ...c, description, updatedAt: new Date().toISOString() };
              return updatedCollection;
            }
            return c;
          }),
        }));

        // Sync to Supabase
        if (updatedCollection && typeof window !== 'undefined') {
          syncCollectionToSupabase(updatedCollection, getDeviceId());
        }
      },

      addProductToCollection: (collectionId, product) => {
        let updatedCollection: Collection | undefined;

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

            updatedCollection = {
              ...c,
              products: updatedProducts,
              coverImages,
              updatedAt: new Date().toISOString(),
            };
            return updatedCollection;
          }),
        }));

        // Sync to Supabase
        if (updatedCollection && typeof window !== 'undefined') {
          syncCollectionToSupabase(updatedCollection, getDeviceId());
        }
      },

      removeProductFromCollection: (collectionId, productId) => {
        let updatedCollection: Collection | undefined;

        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id !== collectionId) return c;

            const updatedProducts = c.products.filter((p) => p.id !== productId);
            const coverImages = updatedProducts
              .slice(0, 4)
              .map((p) => p.image_url)
              .filter(Boolean);

            updatedCollection = {
              ...c,
              products: updatedProducts,
              coverImages,
              updatedAt: new Date().toISOString(),
            };
            return updatedCollection;
          }),
        }));

        // Sync to Supabase
        if (updatedCollection && typeof window !== 'undefined') {
          syncCollectionToSupabase(updatedCollection, getDeviceId());
        }
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
      onRehydrateStorage: () => (state) => {
        // After rehydrating from localStorage, sync with Supabase
        if (state) {
          state.setHydrated(true);
          // Delay sync slightly to allow the app to render first
          setTimeout(() => {
            state.syncWithSupabase();
          }, 1000);
        }
      },
    }
  )
);
