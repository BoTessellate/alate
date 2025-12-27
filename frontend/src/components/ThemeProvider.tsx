'use client';

import { useEffect } from 'react';
import { useSettingsStore, applyTheme } from '@/stores/useSettingsStore';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    // Apply theme on mount and whenever it changes
    applyTheme(theme);

    // Listen for system preference changes when theme is set to 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return <>{children}</>;
}
