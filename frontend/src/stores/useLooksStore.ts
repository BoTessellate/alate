'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CanvasItem {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  content: string;
  src?: string;
  alt?: string;
  productName?: string;
  productBrand?: string;
  productPrice?: number;
  productCurrency?: string;
  text?: string;
  fontSize?: number;
  fontWeight?: string;
}

export interface Moodboard {
  id: string;
  name: string;
  slug: string;
  description?: string;
  items: CanvasItem[];
  backgroundIndex: number;
  createdAt: string;
  updatedAt: string;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface LooksState {
  moodboards: Moodboard[];
  currentMoodboardId: string | null;
  saveStatus: SaveStatus;

  // Moodboard Actions
  createMoodboard: (name: string, description?: string) => Moodboard;
  updateMoodboard: (id: string, updates: Partial<Omit<Moodboard, 'id' | 'slug'>>) => void;
  deleteMoodboard: (id: string) => void;
  getMoodboardBySlug: (slugId: string) => Moodboard | undefined;
  getMoodboardById: (id: string) => Moodboard | undefined;
  setCurrentMoodboard: (id: string | null) => void;
  updateMoodboardItems: (id: string, items: CanvasItem[]) => void;
  setMoodboardBackground: (id: string, backgroundIndex: number) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

// Random color names for generating layer names
const LAYER_COLORS = [
  'coral', 'sage', 'blush', 'amber', 'slate', 'ivory', 'olive', 'rust',
  'mauve', 'teal', 'ochre', 'plum', 'mint', 'clay', 'dusk', 'fern',
  'rose', 'moss', 'sand', 'storm', 'pearl', 'cedar', 'honey', 'ash',
];

// Generate a random layer name in format: colour_mood
export const generateLayerName = (): string => {
  const color = LAYER_COLORS[Math.floor(Math.random() * LAYER_COLORS.length)];
  return `${color}_mood`;
};

// Generate URL-friendly slug from name
export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 50); // Limit length
};

// Generate full URL path: slug--id format (double hyphen separator)
export const generateMoodboardPath = (name: string, id: string): string => {
  const slug = generateSlug(name);
  return `${slug}--${id}`;
};

// Parse slug--id format to extract id (uses double hyphen as separator)
export const parseSlugId = (slugId: string): { slug: string; id: string } | null => {
  // Use double hyphen as separator to handle IDs that contain hyphens
  const separatorIndex = slugId.lastIndexOf('--');
  if (separatorIndex === -1) {
    return null;
  }

  const slug = slugId.substring(0, separatorIndex);
  const id = slugId.substring(separatorIndex + 2); // +2 to skip '--'

  return { slug, id };
};

export const useLooksStore = create<LooksState>()(
  persist(
    (set, get) => ({
      moodboards: [
        {
          id: 'mb-1',
          name: 'Living Room Refresh',
          slug: 'living-room-refresh',
          description: 'Ideas for refreshing my living room',
          items: [],
          backgroundIndex: 0,
          createdAt: '2024-12-15',
          updatedAt: '2024-12-18',
        },
        {
          id: 'mb-2',
          name: 'Bedroom Makeover',
          slug: 'bedroom-makeover',
          description: 'Cozy bedroom inspiration',
          items: [],
          backgroundIndex: 0,
          createdAt: '2024-12-10',
          updatedAt: '2024-12-17',
        },
        {
          id: 'mb-3',
          name: 'Office Space',
          slug: 'office-space',
          description: 'Modern home office setup',
          items: [],
          backgroundIndex: 0,
          createdAt: '2024-12-08',
          updatedAt: '2024-12-16',
        },
      ],
      currentMoodboardId: null,
      saveStatus: 'saved',

      createMoodboard: (name: string, description?: string) => {
        const id = `mb-${Date.now()}`;
        const finalName = name.trim() || generateLayerName();
        const slug = generateSlug(finalName);
        const now = new Date().toISOString().split('T')[0];

        const newMoodboard: Moodboard = {
          id,
          name: finalName,
          slug,
          description,
          items: [],
          backgroundIndex: 0,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          moodboards: [newMoodboard, ...state.moodboards],
          currentMoodboardId: id,
        }));

        return newMoodboard;
      },

      updateMoodboard: (id: string, updates: Partial<Omit<Moodboard, 'id' | 'slug'>>) => {
        set((state) => ({
          moodboards: state.moodboards.map((mb) =>
            mb.id === id
              ? {
                  ...mb,
                  ...updates,
                  slug: updates.name ? generateSlug(updates.name) : mb.slug,
                  updatedAt: new Date().toISOString().split('T')[0],
                }
              : mb
          ),
        }));
      },

      deleteMoodboard: (id: string) => {
        set((state) => ({
          moodboards: state.moodboards.filter((mb) => mb.id !== id),
          currentMoodboardId: state.currentMoodboardId === id ? null : state.currentMoodboardId,
        }));
      },

      getMoodboardBySlug: (slugId: string) => {
        const parsed = parseSlugId(slugId);
        if (!parsed) return undefined;
        return get().moodboards.find((mb) => mb.id === parsed.id);
      },

      getMoodboardById: (id: string) => {
        return get().moodboards.find((mb) => mb.id === id);
      },

      setCurrentMoodboard: (id: string | null) => {
        set({ currentMoodboardId: id });
      },

      updateMoodboardItems: (id: string, items: CanvasItem[]) => {
        set((state) => ({
          moodboards: state.moodboards.map((mb) =>
            mb.id === id
              ? {
                  ...mb,
                  items,
                  updatedAt: new Date().toISOString().split('T')[0],
                }
              : mb
          ),
        }));
      },

      setMoodboardBackground: (id: string, backgroundIndex: number) => {
        set((state) => ({
          moodboards: state.moodboards.map((mb) =>
            mb.id === id
              ? {
                  ...mb,
                  backgroundIndex,
                  updatedAt: new Date().toISOString().split('T')[0],
                }
              : mb
          ),
        }));
      },

      setSaveStatus: (status: SaveStatus) => {
        set({ saveStatus: status });
      },
    }),
    {
      name: 'tml-looks-storage',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;

        if (version < 2) {
          // Migration from v0/v1: Convert old collections/looks structure to moodboards
          const oldCollections = state.collections as Array<{
            id: string;
            name: string;
            slug: string;
            description?: string;
            createdAt: string;
            updatedAt: string;
          }> | undefined;

          const oldLooks = state.looks as Array<{
            id: string;
            collectionId: string;
            items: CanvasItem[];
          }> | undefined;

          if (oldCollections && Array.isArray(oldCollections)) {
            // Convert collections to moodboards
            const moodboards: Moodboard[] = oldCollections.map((col) => {
              // Find looks that belonged to this collection and merge their items
              const collectionLooks = oldLooks?.filter((l) => l.collectionId === col.id) || [];
              const allItems = collectionLooks.flatMap((l) => l.items || []);

              return {
                id: col.id.replace('col-', 'mb-'),
                name: col.name,
                slug: col.slug,
                description: col.description,
                items: allItems,
                backgroundIndex: 0,
                createdAt: col.createdAt,
                updatedAt: col.updatedAt,
              };
            });

            return {
              moodboards,
              currentMoodboardId: null,
              saveStatus: 'saved',
            };
          }
        }

        return state as unknown as LooksState;
      },
    }
  )
);
