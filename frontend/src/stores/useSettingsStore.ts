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
    // Light theme colors
    root.style.setProperty('--background', '#f8f6f3');
    root.style.setProperty('--background-secondary', '#f0ebe4');
    root.style.setProperty('--background-tertiary', '#e8e2d9');
    root.style.setProperty('--surface', '#ffffff');
    root.style.setProperty('--surface-light', '#f5f3f0');
    root.style.setProperty('--surface-elevated', '#fafafa');
    root.style.setProperty('--foreground', '#222222');
    root.style.setProperty('--foreground-secondary', '#555555');
    root.style.setProperty('--foreground-muted', '#888888');
    root.style.setProperty('--border', '#e0dcd5');
    root.style.setProperty('--border-light', '#d0ccc5');
  } else {
    // Dark theme colors (default)
    root.style.setProperty('--background', '#1a1a1a');
    root.style.setProperty('--background-secondary', '#222222');
    root.style.setProperty('--background-tertiary', '#111111');
    root.style.setProperty('--surface', '#2a2a2a');
    root.style.setProperty('--surface-light', '#3a3a3a');
    root.style.setProperty('--surface-elevated', '#4a4a4a');
    root.style.setProperty('--foreground', '#f6e9cf');
    root.style.setProperty('--foreground-secondary', '#d4c9b0');
    root.style.setProperty('--foreground-muted', '#9a9080');
    root.style.setProperty('--border', '#3a3a3a');
    root.style.setProperty('--border-light', '#4a4a4a');
  }

  // Store the applied theme for reference
  root.setAttribute('data-theme', effectiveTheme);
};
