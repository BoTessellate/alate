import { create } from 'zustand';

interface PendingShareStore {
  pendingUrl: string | null;
  setPendingUrl: (url: string | null) => void;
  clearPendingUrl: () => void;
}

export const usePendingShareStore = create<PendingShareStore>((set) => ({
  pendingUrl: null,
  setPendingUrl: (url) => set({ pendingUrl: url }),
  clearPendingUrl: () => set({ pendingUrl: null }),
}));
