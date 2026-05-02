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

/**
 * Canonical product key — used to dedupe history entries when the same
 * product is fit-checked again. Compares origin + path while stripping
 * tracking query params (Shopify's `pr_*`, generic `utm_*`, etc.) that
 * vary per visit but point at the same product.
 *
 * Returns the original URL on parse failure so we always have *some*
 * key to compare on; equality of two unparseable URLs is then exact-
 * string comparison, which is the safest fallback.
 */
const canonicalProductKey = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return rawUrl;
  }
};

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
  /** Made-to-measure / custom-fit signal surfaced by the scraper.
   *  Persisted on the history entry so the lavender pill on the
   *  FitResult hero stays visible when the user re-opens this fit
   *  via History (otherwise the badge disappeared on back-nav since
   *  the activeEntry → product remap dropped the field). */
  customFit?: { available: boolean; label?: string };
}

interface FitHistoryStore {
  entries: FitHistoryEntry[];
  /** Returns the id of the persisted entry. New entries get a fresh
   *  id; re-checking an existing URL returns the existing entry's id
   *  (we dedupe by canonical URL). Callers that need to reference
   *  the saved entry afterwards (e.g. live-mode FitResult promoting
   *  itself to history mode) use this id to resolve precomputed
   *  state on the next render. */
  addEntry: (entry: Omit<FitHistoryEntry, 'id'>) => string;
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
    (set, get) => ({
      entries: [],
      addEntry: (entry) => {
        // Dedupe by canonical product URL — re-checking the same item
        // updates the existing entry's fit score / availability /
        // timestamp instead of stacking up duplicate cards.
        const state = get();
        const key = canonicalProductKey(entry.url);
        const existingIdx = state.entries.findIndex(
          (e) => canonicalProductKey(e.url) === key
        );

        if (existingIdx !== -1) {
          const existing = state.entries[existingIdx];
          const merged: FitHistoryEntry = {
            ...existing,
            ...entry,
            // Keep the original id so anything referencing it
            // (e.g. an open FitResult screen) still resolves.
            id: existing.id,
          };
          const rest = state.entries.filter((_, i) => i !== existingIdx);
          set({ entries: [merged, ...rest].slice(0, 50) });
          return existing.id;
        }

        const id = generateEntryId();
        set({
          entries: [
            { ...entry, id },
            ...state.entries,
          ].slice(0, 50), // Keep last 50 entries
        });
        return id;
      },
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
