import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoulderType = 'narrow' | 'average' | 'broad';
export type BustType = 'small' | 'medium' | 'large' | 'extra-large';
export type WaistType = 'defined' | 'average' | 'undefined';
/**
 * Tummy / midsection projection at and below the natural waist.
 * Distinct from `WaistType` (which captures silhouette curve, not
 * depth). Critical for non-stretch garments — high-rise trousers,
 * fitted shirts, pencil skirts, A-line dresses all need extra room
 * when the abdomen projects past the waistband. Added April 29 2026
 * after a user flagged it as a missing fit factor; ships in beta.
 */
export type TummyType = 'flat' | 'slight' | 'soft' | 'full';
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
  /** Optional for backward-compat with avatars persisted before the
   *  field was introduced (April 29 2026). New onboarding always
   *  sets it. Backend `checkFit` ignores unknown fields gracefully
   *  so passing it is non-breaking even before fit-rule wiring. */
  tummy?: TummyType;
  hips: HipType;
  thighs: ThighType;
  torso_length: TorsoType;
}

interface AvatarStore {
  avatar: Avatar | null;
  /**
   * ISO timestamp of the last meaningful avatar change. Used by FitResult
   * to detect stale entries (any history entry whose `checkedAt` predates
   * `lastChangedAt` was evaluated against an older body and should be
   * re-evaluated on view, regardless of which screen path the user took).
   *
   * Stays untouched if `setAvatar` is called with an identical value, so
   * a re-render or save-without-change doesn't cascade into re-evals.
   */
  lastChangedAt: string | null;
  setAvatar: (avatar: Avatar) => void;
  clearAvatar: () => void;
}

function avatarsEqual(a: Avatar | null, b: Avatar | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.height_cm === b.height_cm &&
    a.gender === b.gender &&
    a.shoulders === b.shoulders &&
    a.bust === b.bust &&
    a.waist === b.waist &&
    a.tummy === b.tummy &&
    a.hips === b.hips &&
    a.thighs === b.thighs &&
    a.torso_length === b.torso_length
  );
}

export const useAvatarStore = create<AvatarStore>()(
  persist(
    (set, get) => ({
      avatar: null,
      lastChangedAt: null,
      setAvatar: (avatar) => {
        // Skip the timestamp bump for no-op saves — saves a few useless
        // re-evaluations when the user opens AvatarSetup, taps Save without
        // editing, and returns. Only structural change moves the clock.
        if (avatarsEqual(avatar, get().avatar)) return;
        set({ avatar, lastChangedAt: new Date().toISOString() });
      },
      clearAvatar: () => {
        if (get().avatar === null) return;
        set({ avatar: null, lastChangedAt: new Date().toISOString() });
      },
    }),
    {
      name: 'avatar-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
