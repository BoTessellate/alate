import { create } from 'zustand';

export interface TextOverlay {
  id: string;
  word: string;
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  albumArt?: string;
}

interface EditorState {
  imageUri: string | null;
  overlays: TextOverlay[];
  trackMetadata?: TrackMetadata;
  setImage: (uri: string | null) => void;
  addOverlay: (word: string, seed?: Partial<Omit<TextOverlay, 'id' | 'word'>>) => string;
  updateOverlay: (id: string, patch: Partial<Omit<TextOverlay, 'id'>>) => void;
  removeOverlay: (id: string) => void;
  setTrackMetadata: (track: TrackMetadata | undefined) => void;
  reset: () => void;
}

function makeId(): string {
  return `ov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useEditorStore = create<EditorState>((set) => ({
  imageUri: null,
  overlays: [],
  trackMetadata: undefined,

  setImage: (uri) => set({ imageUri: uri }),

  addOverlay: (word, seed) => {
    const id = makeId();
    const overlay: TextOverlay = {
      id,
      word,
      x: seed?.x ?? 0,
      y: seed?.y ?? 0,
      scale: seed?.scale ?? 1,
      rotate: seed?.rotate ?? 0,
    };
    set((s) => ({ overlays: [...s.overlays, overlay] }));
    return id;
  },

  updateOverlay: (id, patch) =>
    set((s) => ({
      overlays: s.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })),

  removeOverlay: (id) =>
    set((s) => ({ overlays: s.overlays.filter((o) => o.id !== id) })),

  setTrackMetadata: (track) => set({ trackMetadata: track }),

  reset: () => set({ imageUri: null, overlays: [], trackMetadata: undefined }),
}));
