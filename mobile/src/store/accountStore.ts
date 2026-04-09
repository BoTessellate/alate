import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  photoUrl?: string;
}

export interface BrandSizeEntry {
  id: string;
  brand: string;
  size: string;
  category?: string;
  addedAt: string;
}

interface AccountState {
  user: GoogleUser | null;
  brandSizes: BrandSizeEntry[];
  setUser: (user: GoogleUser | null) => void;
  addBrandSize: (entry: Omit<BrandSizeEntry, 'id' | 'addedAt'>) => void;
  removeBrandSize: (id: string) => void;
  clearAccount: () => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      user: null,
      brandSizes: [],
      setUser: (user) => set({ user }),
      addBrandSize: (entry) =>
        set((state) => ({
          brandSizes: [
            ...state.brandSizes,
            {
              ...entry,
              id: Math.random().toString(36).substr(2, 9),
              addedAt: new Date().toISOString(),
            },
          ],
        })),
      removeBrandSize: (id) =>
        set((state) => ({
          brandSizes: state.brandSizes.filter((e) => e.id !== id),
        })),
      clearAccount: () => set({ user: null }),
    }),
    {
      name: 'account-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
