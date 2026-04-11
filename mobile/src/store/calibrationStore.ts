import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Calibration store — list of garments the user owns that fit them well (or
 * almost). Each entry is sent to the backend's `calibrate-garment` action, which
 * uses Claude to estimate the user's actual cm body measurements based on the
 * brand's typical sizing for that garment + the fit feedback. The averaged
 * estimates across all entries are then sent on every fit check, dramatically
 * improving size recommendation accuracy (this is the Zalando "user's normal
 * size is the strongest signal" principle).
 *
 * The averaged value is also exposed as `getAveragedCalibration()` so the UI
 * can show a derived "Your usual size: M" headline based on the calibration
 * data we already have, without needing a separate field on the avatar.
 */

const generateId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;

export type GarmentFit = 'perfect' | 'slightly-tight' | 'slightly-loose';

export type GarmentCategory = 'top' | 'bottom' | 'dress' | 'outerwear';

/** AI-estimated body measurements in cm derived from a single garment */
export interface EstimatedMeasurements {
  bust_cm: number;
  waist_cm: number;
  hips_cm: number;
  shoulders_cm: number;
}

export interface CalibrationGarment {
  id: string;
  brand: string;
  size: string;
  category: GarmentCategory;
  fit: GarmentFit;
  estimated: EstimatedMeasurements;
  addedAt: string;
}

interface CalibrationStore {
  garments: CalibrationGarment[];
  addGarment: (garment: Omit<CalibrationGarment, 'id' | 'addedAt'>) => void;
  removeGarment: (id: string) => void;
  clearAll: () => void;
}

export const useCalibrationStore = create<CalibrationStore>()(
  persist(
    (set) => ({
      garments: [],
      addGarment: (garment) =>
        set((state) => ({
          garments: [
            {
              ...garment,
              id: generateId(),
              addedAt: new Date().toISOString(),
            },
            ...state.garments,
          ].slice(0, 20), // cap at 20 calibration entries
        })),
      removeGarment: (id) =>
        set((state) => ({
          garments: state.garments.filter((g) => g.id !== id),
        })),
      clearAll: () => set({ garments: [] }),
    }),
    {
      name: 'calibration-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Average all calibration garments into a single set of body cm measurements.
 * Returns null when there are no entries (caller should fall back to
 * label-based avatar measurements).
 */
export function averageCalibration(
  garments: CalibrationGarment[]
): EstimatedMeasurements | null {
  if (garments.length === 0) return null;
  const sum = garments.reduce(
    (acc, g) => ({
      bust_cm: acc.bust_cm + g.estimated.bust_cm,
      waist_cm: acc.waist_cm + g.estimated.waist_cm,
      hips_cm: acc.hips_cm + g.estimated.hips_cm,
      shoulders_cm: acc.shoulders_cm + g.estimated.shoulders_cm,
    }),
    { bust_cm: 0, waist_cm: 0, hips_cm: 0, shoulders_cm: 0 }
  );
  return {
    bust_cm: Math.round(sum.bust_cm / garments.length),
    waist_cm: Math.round(sum.waist_cm / garments.length),
    hips_cm: Math.round(sum.hips_cm / garments.length),
    shoulders_cm: Math.round(sum.shoulders_cm / garments.length),
  };
}

/**
 * Derive the user's "typical size" letter from the averaged calibration.
 * Mirrors the backend's recommendSize logic but using only bust+hips so the
 * Account screen can display a headline like "Your usual size: M".
 *
 * NOTE: This is a UI helper. The authoritative size recommendation still comes
 * from the backend on every fit check.
 */
export function deriveTypicalSize(
  averaged: EstimatedMeasurements | null
): { size: string; confidence: 'high' | 'medium' | 'low' } | null {
  if (!averaged) return null;

  const bustScore =
    averaged.bust_cm < 84 ? 1 : averaged.bust_cm < 94 ? 2 : averaged.bust_cm < 104 ? 3 : 4;
  const hipScore =
    averaged.hips_cm < 88 ? 1 : averaged.hips_cm < 98 ? 2 : averaged.hips_cm < 108 ? 3 : 4;

  const avg = (bustScore + hipScore) / 2;
  const size =
    avg <= 1.25 ? 'XS'
    : avg <= 1.75 ? 'S'
    : avg <= 2.5 ? 'M'
    : avg <= 3.25 ? 'L'
    : avg <= 3.75 ? 'XL'
    : 'XXL';

  const divergence = Math.abs(bustScore - hipScore);
  const confidence: 'high' | 'medium' | 'low' =
    divergence >= 2 ? 'low' : divergence === 1 ? 'medium' : 'high';

  return { size, confidence };
}
