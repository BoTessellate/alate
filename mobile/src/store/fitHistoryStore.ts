import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Generate a collision-resistant id for history entries.
 *
 * Previously used `Date.now().toString()`, which collided when two entries
 * were added in the same millisecond — `removeEntry(id)` then deleted both.
 * Combining the timestamp with a random suffix keeps ids monotonic for
 * natural sort order while making collisions effectively impossible.
 */
const generateEntryId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;

export interface FitWarning {
  severity: 'minor' | 'moderate' | 'major';
  message: string;
}

export interface HistorySizeRecommendation {
  size: string;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

export interface HistoryPrice {
  amount: number;
  currency: string;
}

export interface FitHistoryEntry {
  id: string;
  url: string;
  productName: string;
  productImage?: string;
  fitScore: 'great' | 'moderate' | 'poor';
  warnings: FitWarning[];
  checkedAt: string;
  // Enriched data (persisted so history cards can show rich info)
  sizeRecommendation?: HistorySizeRecommendation;
  category?: string;
  material?: string;
  tags?: string[];
  price?: HistoryPrice;
  brand?: string;
}

interface FitHistoryStore {
  entries: FitHistoryEntry[];
  addEntry: (entry: Omit<FitHistoryEntry, 'id'>) => void;
  updateEntry: (id: string, patch: Partial<Omit<FitHistoryEntry, 'id'>>) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
}

export const useFitHistoryStore = create<FitHistoryStore>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [
            { ...entry, id: generateEntryId() },
            ...state.entries,
          ].slice(0, 50), // Keep last 50 entries
        })),
      updateEntry: (id, patch) =>
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),
      clearHistory: () => set({ entries: [] }),
    }),
    {
      name: 'fit-history-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
