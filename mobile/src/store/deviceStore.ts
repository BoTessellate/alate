/**
 * Device ID store — stable per-install identifier.
 *
 * Used as an `X-Device-Id` header on every backend API call, so
 * rate-limiting keys per-install instead of per-IP (which unfairly
 * penalises users behind shared NAT).
 *
 * Not tied to any PII. It's a random UUID generated on first launch,
 * persisted locally via AsyncStorage. If the user deletes app data
 * or reinstalls, they get a fresh ID — that's fine.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DeviceState {
  deviceId: string | null;
  ensureDeviceId: () => string;
}

/** UUID v4 generator — no external deps. Good enough for identifier
 *  purposes; not cryptographically random. */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      deviceId: null,
      ensureDeviceId: () => {
        const existing = get().deviceId;
        if (existing) return existing;
        const fresh = generateUUID();
        set({ deviceId: fresh });
        return fresh;
      },
    }),
    {
      name: 'alate-device',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
