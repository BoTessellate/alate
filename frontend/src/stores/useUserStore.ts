import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StylePreferences } from '@/types';

interface UserState {
  stylePreferences: StylePreferences;
  setStyleTags: (tags: string[]) => void;
  setStyleCategories: (categories: string[]) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  hasCompletedOnboarding: () => boolean;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      stylePreferences: {
        selectedTags: [],
        selectedCategories: [],
        completedOnboarding: false,
      },

      setStyleTags: (tags) =>
        set((state) => ({
          stylePreferences: { ...state.stylePreferences, selectedTags: tags },
        })),

      setStyleCategories: (categories) =>
        set((state) => ({
          stylePreferences: { ...state.stylePreferences, selectedCategories: categories },
        })),

      completeOnboarding: () =>
        set((state) => ({
          stylePreferences: {
            ...state.stylePreferences,
            completedOnboarding: true,
            onboardingCompletedAt: new Date().toISOString(),
          },
        })),

      resetOnboarding: () =>
        set({
          stylePreferences: {
            selectedTags: [],
            selectedCategories: [],
            completedOnboarding: false,
          },
        }),

      hasCompletedOnboarding: () => get().stylePreferences.completedOnboarding,
    }),
    {
      name: 'tml-user-storage',
    }
  )
);
