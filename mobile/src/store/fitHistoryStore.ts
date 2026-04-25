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

/** Per-size availability snapshot at the time of fit-check.
 *  Persisted on the history entry so cards opened later still show
 *  the original "in stock at L?" answer; the user can re-check by
 *  re-running the fit-check (Re-evaluate button). */
export interface HistoryAvailability {
  status: 'in_stock' | 'out_of_stock' | 'unknown';
  /** The size we checked against — usually `sizeRecommendation.size`
   *  at the moment availability was computed. */
  size?: string;
  /** When this snapshot was taken (ISO timestamp). */
  checkedAt: string;
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
  /** Availability of the recommended size at scrape time. Optional
   *  because pre-availability history entries don't have this field;
   *  components should treat missing as "unknown". */
  availability?: HistoryAvailability;
}

interface FitHistoryStore {
  entries: FitHistoryEntry[];
  addEntry: (entry: Omit<FitHistoryEntry, 'id'>) => void;
  updateEntry: (id: string, patch: Partial<Omit<FitHistoryEntry, 'id'>>) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
  // Dev-only: bulk-seed history when it's empty so the cover flow has
  // something to scroll. No-op if entries already exist, so running the app
  // again doesn't duplicate. Intended to be called from App.tsx under __DEV__.
  seedDevHistory: (raw: Omit<FitHistoryEntry, 'id'>[]) => void;
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
      seedDevHistory: (raw) =>
        set((state) =>
          state.entries.length > 0
            ? state
            : { entries: raw.map((e) => ({ ...e, id: generateEntryId() })) }
        ),
    }),
    {
      name: 'fit-history-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
