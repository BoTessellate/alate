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

export interface Look {
  id: string;
  name: string;
  slug: string;
  thumbnail: string | null;
  items: CanvasItem[];
  createdAt: string;
  updatedAt: string;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface LooksState {
  looks: Look[];
  currentLookId: string | null;
  saveStatus: SaveStatus;

  // Actions
  createLook: (name: string) => Look;
  updateLook: (id: string, updates: Partial<Omit<Look, 'id' | 'slug'>>) => void;
  deleteLook: (id: string) => void;
  getLookBySlug: (slug: string) => Look | undefined;
  getLookById: (id: string) => Look | undefined;
  setCurrentLook: (id: string | null) => void;
  updateLookItems: (id: string, items: CanvasItem[]) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

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

// Generate full URL path: slug-id format
export const generateLookPath = (name: string, id: string): string => {
  const slug = generateSlug(name);
  return `${slug}-${id}`;
};

// Parse slug-id format to extract id
export const parseSlugId = (slugId: string): { slug: string; id: string } | null => {
  // The ID is always the last segment after the last hyphen
  const lastHyphenIndex = slugId.lastIndexOf('-');
  if (lastHyphenIndex === -1) {
    return null;
  }

  const slug = slugId.substring(0, lastHyphenIndex);
  const id = slugId.substring(lastHyphenIndex + 1);

  return { slug, id };
};

export const useLooksStore = create<LooksState>()(
  persist(
    (set, get) => ({
      looks: [
        {
          id: '1',
          name: 'Living Room Refresh',
          slug: 'living-room-refresh',
          thumbnail: null,
          items: [],
          createdAt: '2024-12-15',
          updatedAt: '2024-12-18',
        },
        {
          id: '2',
          name: 'Bedroom Makeover',
          slug: 'bedroom-makeover',
          thumbnail: null,
          items: [],
          createdAt: '2024-12-10',
          updatedAt: '2024-12-17',
        },
        {
          id: '3',
          name: 'Office Space',
          slug: 'office-space',
          thumbnail: null,
          items: [],
          createdAt: '2024-12-08',
          updatedAt: '2024-12-16',
        },
      ],
      currentLookId: null,
      saveStatus: 'saved',

      createLook: (name: string) => {
        const id = Date.now().toString();
        const slug = generateSlug(name);
        const now = new Date().toISOString().split('T')[0];

        const newLook: Look = {
          id,
          name: name.trim() || 'Untitled Look',
          slug,
          thumbnail: null,
          items: [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          looks: [newLook, ...state.looks],
          currentLookId: id,
        }));

        return newLook;
      },

      updateLook: (id: string, updates: Partial<Omit<Look, 'id' | 'slug'>>) => {
        set((state) => ({
          looks: state.looks.map((look) =>
            look.id === id
              ? {
                  ...look,
                  ...updates,
                  // Update slug if name changed
                  slug: updates.name ? generateSlug(updates.name) : look.slug,
                  updatedAt: new Date().toISOString().split('T')[0],
                }
              : look
          ),
        }));
      },

      deleteLook: (id: string) => {
        set((state) => ({
          looks: state.looks.filter((look) => look.id !== id),
          currentLookId: state.currentLookId === id ? null : state.currentLookId,
        }));
      },

      getLookBySlug: (slugId: string) => {
        const parsed = parseSlugId(slugId);
        if (!parsed) return undefined;

        return get().looks.find((look) => look.id === parsed.id);
      },

      getLookById: (id: string) => {
        return get().looks.find((look) => look.id === id);
      },

      setCurrentLook: (id: string | null) => {
        set({ currentLookId: id });
      },

      updateLookItems: (id: string, items: CanvasItem[]) => {
        set((state) => ({
          looks: state.looks.map((look) =>
            look.id === id
              ? {
                  ...look,
                  items,
                  updatedAt: new Date().toISOString().split('T')[0],
                }
              : look
          ),
        }));
      },

      setSaveStatus: (status: SaveStatus) => {
        set({ saveStatus: status });
      },
    }),
    {
      name: 'tml-looks-storage',
    }
  )
);
