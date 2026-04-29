/**
 * Age gate store — persists the user's one-time confirmation that
 * they're 16+ (the stricter of GDPR Article 8 and DPDPA).
 *
 * Stored locally via AsyncStorage (same as avatarStore). We never
 * send this field to the backend; its only job is to gate the first-
 * launch experience plus block downstream data-collection flows
 * (avatar setup, share-intent paste-to-fit) when the user has
 * self-declared as under 16.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AgeGateState {
  confirmedAt: string | null;
  /** True if the user self-declared as under 16. Keeps them out of
   *  any flow that collects or shares body data — share-intent
   *  paste-to-fit is blocked, the deflection screen sticks across
   *  launches. Cleared by reset() (Settings → Delete profile, or
   *  test setup). */
  declaredUnder16: boolean;
  /** Mark the user as having confirmed they're 16 or older. */
  confirm: () => void;
  /** Mark the user as having self-declared under 16. Sets the flag
   *  AND keeps confirmedAt null so the gate stays closed. The UI
   *  treats this as a soft block: the deflection screen stays up
   *  and ShareIntent listeners ignore incoming URLs. */
  declineAsUnder16: () => void;
  /** Undo all gate state — exposed for tests + the "delete my
   *  profile" flow, where clearing measurement data should also
   *  reset the gate so the user is re-prompted from scratch. */
  reset: () => void;
}

export const useAgeGateStore = create<AgeGateState>()(
  persist(
    (set) => ({
      confirmedAt: null,
      declaredUnder16: false,
      confirm: () =>
        set({ confirmedAt: new Date().toISOString(), declaredUnder16: false }),
      declineAsUnder16: () =>
        set({ confirmedAt: null, declaredUnder16: true }),
      reset: () => set({ confirmedAt: null, declaredUnder16: false }),
    }),
    {
      name: 'alate-age-gate',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
