import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoulderType = 'narrow' | 'average' | 'broad';
export type BustType = 'small' | 'medium' | 'large' | 'extra-large';
export type WaistType = 'defined' | 'average' | 'undefined';
export type HipType = 'narrow' | 'average' | 'wide' | 'extra-wide';
export type ThighType = 'slim' | 'average' | 'muscular' | 'full';
export type TorsoType = 'short' | 'average' | 'long';

export interface Avatar {
  height_cm: number;
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
