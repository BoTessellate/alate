import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GoogleUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

interface AccountStore {
  googleUser: GoogleUser | null;
  setGoogleUser: (user: GoogleUser | null) => void;
  clearAccount: () => void;
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      googleUser: null,
      setGoogleUser: (user) => set({ googleUser: user }),
      clearAccount: () => set({ googleUser: null }),
    }),
    {
      name: 'account-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
