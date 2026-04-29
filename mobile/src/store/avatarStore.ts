import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoulderType = 'narrow' | 'average' | 'broad';
export type BustType = 'small' | 'medium' | 'large' | 'extra-large';
export type WaistType = 'defined' | 'average' | 'undefined';
export type HipType = 'narrow' | 'average' | 'wide' | 'extra-wide';
export type ThighType = 'slim' | 'average' | 'muscular' | 'full';
export type TorsoType = 'short' | 'average' | 'long';
/**
 * Self-described gender for fit modelling. AvatarSetup uses this to
 * adapt the bust/chest chip label, and any future silhouette /
 * sizing-rule branches read from this single source. Three options
 * keep the menu short and match standard apparel-app conventions; we
 * deliberately don't include "prefer not to say" because the field is
 * required for fit reasoning — the closest neutral choice is
 * `nonbinary`, which leaves the body-shape chips unbiased.
 *
 * Legacy avatars persisted before this field existed have no
 * `gender` value. Consumers MUST read `avatar?.gender ?? 'woman'` to
 * get the historical default — the app originally shipped as
 * bust-only, so that's the safe fallback for users mid-flight.
 */
export type GenderType = 'woman' | 'man' | 'nonbinary';

export interface Avatar {
  height_cm: number;
  /** Optional for backward-compat with avatars persisted before the
   *  field was introduced (April 2026). New onboarding always sets
   *  it. Read with `?? 'woman'`. */
  gender?: GenderType;
  shoulders: ShoulderType;
  bust: BustType;
  waist: WaistType;
  hips: HipType;
  thighs: ThighType;
  torso_length: TorsoType;
}

interface AvatarStore {
  avatar: Avatar | null;
  setAvatar: (avatar: Avatar) => void;
  clearAvatar: () => void;
}

export const useAvatarStore = create<AvatarStore>()(
  persist(
    (set) => ({
      avatar: null,
      setAvatar: (avatar) => set({ avatar }),
      clearAvatar: () => set({ avatar: null }),
    }),
    {
      name: 'avatar-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
