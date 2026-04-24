/**
 * Age gate store — persists the user's one-time confirmation that
 * they're 16+ (the stricter of GDPR Article 8 and DPDPA).
 *
 * Stored locally via AsyncStorage (same as avatarStore). We never
 * send this field to the backend; its only job is to gate the first-
 * launch experience.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AgeGateState {
  confirmedAt: string | null;
  /** Mark the user as having confirmed they're 16 or older. */
  confirm: () => void;
  /** Undo confirmation — exposed for tests + the "delete my profile"
   *  flow, where clearing measurement data should also force re-prompt. */
  reset: () => void;
}

export const useAgeGateStore = create<AgeGateState>()(
  persist(
    (set) => ({
      confirmedAt: null,
      confirm: () => set({ confirmedAt: new Date().toISOString() }),
      reset: () => set({ confirmedAt: null }),
    }),
    {
      name: 'alate-age-gate',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
