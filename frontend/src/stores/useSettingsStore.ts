import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { THEME_TOKENS, applyThemeTokens } from '@/constants/theme';

export type Theme = 'light' | 'dark' | 'system';

// Currency display preference
export type CurrencyDisplayMode = 'original' | 'local';
export type LocalCurrency = 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'AUD' | 'CAD';

interface SettingsState {
  theme: Theme;
  agentModeEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  // Currency settings
  currencyDisplayMode: CurrencyDisplayMode;
  localCurrency: LocalCurrency;
  // User settings (placeholder until auth is implemented)
  userName: string | null;
  isLoggedIn: boolean;
  setTheme: (theme: Theme) => void;
  setAgentMode: (enabled: boolean) => void;
  setEmailNotifications: (enabled: boolean) => void;
  setPushNotifications: (enabled: boolean) => void;
  setCurrencyDisplayMode: (mode: CurrencyDisplayMode) => void;
  setLocalCurrency: (currency: LocalCurrency) => void;
  setUserName: (name: string | null) => void;
  setIsLoggedIn: (loggedIn: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      agentModeEnabled: false,
      emailNotifications: true,
      pushNotifications: false,
      currencyDisplayMode: 'local',
      localCurrency: 'JPY',
      userName: null,
      isLoggedIn: false,
      setTheme: (theme) => set({ theme }),
      setAgentMode: (enabled) => set({ agentModeEnabled: enabled }),
      setEmailNotifications: (enabled) => set({ emailNotifications: enabled }),
      setPushNotifications: (enabled) => set({ pushNotifications: enabled }),
      setCurrencyDisplayMode: (mode) => set({ currencyDisplayMode: mode }),
      setLocalCurrency: (currency) => set({ localCurrency: currency }),
      setUserName: (name) => set({ userName: name }),
      setIsLoggedIn: (loggedIn) => set({ isLoggedIn: loggedIn }),
    }),
    {
      name: 'mood-layer-settings',
    }
  )
);

// Helper to apply theme to document
export const applyTheme = (theme: Theme) => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  applyThemeTokens(effectiveTheme);
};

// Re-export for convenience
export { THEME_TOKENS };
