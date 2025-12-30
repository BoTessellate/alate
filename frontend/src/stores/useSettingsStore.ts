import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

// Currency display preference
export type CurrencyDisplayMode = 'original' | 'local';
export type LocalCurrency = 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'AUD' | 'CAD';

interface SettingsState {
  theme: Theme;
  aiModeEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  // Currency settings
  currencyDisplayMode: CurrencyDisplayMode;
  localCurrency: LocalCurrency;
  setTheme: (theme: Theme) => void;
  setAiMode: (enabled: boolean) => void;
  setEmailNotifications: (enabled: boolean) => void;
  setPushNotifications: (enabled: boolean) => void;
  setCurrencyDisplayMode: (mode: CurrencyDisplayMode) => void;
  setLocalCurrency: (currency: LocalCurrency) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      aiModeEnabled: false,
      emailNotifications: true,
      pushNotifications: false,
      currencyDisplayMode: 'original',
      localCurrency: 'USD',
      setTheme: (theme) => set({ theme }),
      setAiMode: (enabled) => set({ aiModeEnabled: enabled }),
      setEmailNotifications: (enabled) => set({ emailNotifications: enabled }),
      setPushNotifications: (enabled) => set({ pushNotifications: enabled }),
      setCurrencyDisplayMode: (mode) => set({ currencyDisplayMode: mode }),
      setLocalCurrency: (currency) => set({ localCurrency: currency }),
    }),
    {
      name: 'mood-layer-settings',
    }
  )
);

// Helper to apply theme to document
export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const effectiveTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  if (effectiveTheme === 'light') {
    // Light theme colors - warm brand tones (cream/green)
    root.style.setProperty('--background', '#e8dcc8');
    root.style.setProperty('--background-secondary', '#ddd0ba');
    root.style.setProperty('--background-tertiary', '#d2c4ac');
    root.style.setProperty('--surface', '#f5ebe0');
    root.style.setProperty('--surface-light', '#ebe0d4');
    root.style.setProperty('--surface-elevated', '#faf6f0');
    root.style.setProperty('--foreground', '#2d3a24');
    root.style.setProperty('--foreground-secondary', '#4a5a3d');
    root.style.setProperty('--foreground-muted', '#6b7a5e');
    root.style.setProperty('--border', '#c4b8a0');
    root.style.setProperty('--border-light', '#b8a890');
    root.style.setProperty('--topbar-bg', 'rgba(76, 112, 49, 0.92)');
  } else {
    // Dark theme colors (default) - deeper, richer tones
    root.style.setProperty('--background', '#0d0d0d');
    root.style.setProperty('--background-secondary', '#151515');
    root.style.setProperty('--background-tertiary', '#0a0a0a');
    root.style.setProperty('--surface', '#1a1a1a');
    root.style.setProperty('--surface-light', '#252525');
    root.style.setProperty('--surface-elevated', '#303030');
    root.style.setProperty('--foreground', '#f6e9cf');
    root.style.setProperty('--foreground-secondary', '#d4c9b0');
    root.style.setProperty('--foreground-muted', '#9a9080');
    root.style.setProperty('--border', '#2a2a2a');
    root.style.setProperty('--border-light', '#3a3a3a');
    root.style.setProperty('--topbar-bg', 'rgba(76, 112, 49, 0.92)');
  }

  // Store the applied theme for reference
  root.setAttribute('data-theme', effectiveTheme);
};
