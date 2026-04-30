import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const ACCESS_KEY = 'alate.spotify.accessToken';
const REFRESH_KEY = 'alate.spotify.refreshToken';

export interface MusicTrack {
  title: string;
  artist: string;
  albumArt?: string;
}

interface MusicState {
  accessToken: string | null;
  refreshToken: string | null;
  currentTrack: MusicTrack | null;
  setTokens: (access: string | null, refresh: string | null) => Promise<void>;
  loadTokens: () => Promise<void>;
  fetchNowPlaying: () => Promise<void>;
  refreshAccessToken: (clientId: string) => Promise<boolean>;
  disconnect: () => void;
}

function parseTrack(payload: any): MusicTrack | null {
  const item = payload?.item;
  if (!item) return null;
  const title = typeof item.name === 'string' ? item.name : '';
  const artist = Array.isArray(item.artists) && item.artists[0]?.name ? item.artists[0].name : '';
  const albumArt = item.album?.images?.[0]?.url;
  if (!title) return null;
  return { title, artist, albumArt };
}

export const useMusicStore = create<MusicState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  currentTrack: null,

  setTokens: async (access, refresh) => {
    set({ accessToken: access, refreshToken: refresh });
    try {
      if (access) await SecureStore.setItemAsync(ACCESS_KEY, access);
      else await SecureStore.deleteItemAsync(ACCESS_KEY);
      if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
      else await SecureStore.deleteItemAsync(REFRESH_KEY);
    } catch {
      // SecureStore failures are non-fatal — tokens stay in memory.
    }
  },

  loadTokens: async () => {
    try {
      const access = await SecureStore.getItemAsync(ACCESS_KEY);
      const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
      set({ accessToken: access ?? null, refreshToken: refresh ?? null });
    } catch {
      // Ignore — first launch or keychain denied.
    }
  },

  fetchNowPlaying: async () => {
    const token = get().accessToken;
    if (!token) return;
    try {
      const res = await fetch(`${SPOTIFY_API}/me/player/currently-playing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 204) {
        set({ currentTrack: null });
        return;
      }
      if (res.status === 401) {
        // Token expired. Caller is expected to trigger refreshAccessToken.
        return;
      }
      if (!res.ok) return;
      const json = await res.json();
      if (json?.is_playing === false) {
        set({ currentTrack: null });
        return;
      }
      set({ currentTrack: parseTrack(json) });
    } catch {
      // Network error — leave prior track state alone; never throw.
    }
  },

  refreshAccessToken: async (clientId) => {
    const refresh = get().refreshToken;
    if (!refresh) return false;
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: clientId,
      }).toString();
      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) return false;
      const json = await res.json();
      const newAccess: string | null = json.access_token ?? null;
      const newRefresh: string | null = json.refresh_token ?? refresh;
      if (!newAccess) return false;
      await get().setTokens(newAccess, newRefresh);
      return true;
    } catch {
      return false;
    }
  },

  disconnect: () => {
    set({ accessToken: null, refreshToken: null, currentTrack: null });
    SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => {});
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
  },
}));
