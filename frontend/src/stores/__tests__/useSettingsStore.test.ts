import { renderHook, act } from '@testing-library/react';
import { useSettingsStore, applyTheme, THEME_TOKENS, Theme, CurrencyDisplayMode, LocalCurrency } from '../useSettingsStore';

// Mock document and window for applyTheme tests
const mockSetProperty = jest.fn();
const mockSetAttribute = jest.fn();

beforeAll(() => {
  Object.defineProperty(document, 'documentElement', {
    value: {
      style: {
        setProperty: mockSetProperty,
      },
      setAttribute: mockSetAttribute,
    },
    writable: true,
  });
});

describe('useSettingsStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    useSettingsStore.setState({
      theme: 'system',
      agentModeEnabled: false,
      emailNotifications: true,
      pushNotifications: false,
      currencyDisplayMode: 'local',
      localCurrency: 'JPY',
      userName: null,
      isLoggedIn: false,
    });
    mockSetProperty.mockClear();
    mockSetAttribute.mockClear();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useSettingsStore());

      expect(result.current.theme).toBe('system');
      expect(result.current.agentModeEnabled).toBe(false);
      expect(result.current.emailNotifications).toBe(true);
      expect(result.current.pushNotifications).toBe(false);
      expect(result.current.currencyDisplayMode).toBe('local');
      expect(result.current.localCurrency).toBe('JPY');
      expect(result.current.userName).toBeNull();
      expect(result.current.isLoggedIn).toBe(false);
    });
  });

  describe('Theme Management', () => {
    it('should update theme to dark', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should update theme to light', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
    });

    it('should update theme to system', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setTheme('dark');
      });
      act(() => {
        result.current.setTheme('system');
      });

      expect(result.current.theme).toBe('system');
    });

    it('should accept all valid theme values', () => {
      const { result } = renderHook(() => useSettingsStore());
      const themes: Theme[] = ['light', 'dark', 'system'];

      themes.forEach((theme) => {
        act(() => {
          result.current.setTheme(theme);
        });
        expect(result.current.theme).toBe(theme);
      });
    });
  });

  describe('Agent Mode', () => {
    it('should enable agent mode', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setAgentMode(true);
      });

      expect(result.current.agentModeEnabled).toBe(true);
    });

    it('should disable agent mode', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setAgentMode(true);
      });
      act(() => {
        result.current.setAgentMode(false);
      });

      expect(result.current.agentModeEnabled).toBe(false);
    });
  });

  describe('Notification Settings', () => {
    it('should toggle email notifications on', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setEmailNotifications(false);
      });
      act(() => {
        result.current.setEmailNotifications(true);
      });

      expect(result.current.emailNotifications).toBe(true);
    });

    it('should toggle email notifications off', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setEmailNotifications(false);
      });

      expect(result.current.emailNotifications).toBe(false);
    });

    it('should toggle push notifications on', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setPushNotifications(true);
      });

      expect(result.current.pushNotifications).toBe(true);
    });

    it('should toggle push notifications off', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setPushNotifications(true);
      });
      act(() => {
        result.current.setPushNotifications(false);
      });

      expect(result.current.pushNotifications).toBe(false);
    });
  });

  describe('Currency Settings', () => {
    it('should update currency display mode to original', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrencyDisplayMode('original');
      });

      expect(result.current.currencyDisplayMode).toBe('original');
    });

    it('should update currency display mode to local', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setCurrencyDisplayMode('original');
      });
      act(() => {
        result.current.setCurrencyDisplayMode('local');
      });

      expect(result.current.currencyDisplayMode).toBe('local');
    });

    it('should accept all valid currency display modes', () => {
      const { result } = renderHook(() => useSettingsStore());
      const modes: CurrencyDisplayMode[] = ['original', 'local'];

      modes.forEach((mode) => {
        act(() => {
          result.current.setCurrencyDisplayMode(mode);
        });
        expect(result.current.currencyDisplayMode).toBe(mode);
      });
    });

    it('should update local currency', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setLocalCurrency('USD');
      });

      expect(result.current.localCurrency).toBe('USD');
    });

    it('should accept all valid local currencies', () => {
      const { result } = renderHook(() => useSettingsStore());
      const currencies: LocalCurrency[] = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD'];

      currencies.forEach((currency) => {
        act(() => {
          result.current.setLocalCurrency(currency);
        });
        expect(result.current.localCurrency).toBe(currency);
      });
    });
  });

  describe('User Settings', () => {
    it('should set user name', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setUserName('John Doe');
      });

      expect(result.current.userName).toBe('John Doe');
    });

    it('should clear user name to null', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setUserName('John Doe');
      });
      act(() => {
        result.current.setUserName(null);
      });

      expect(result.current.userName).toBeNull();
    });

    it('should set login status to true', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setIsLoggedIn(true);
      });

      expect(result.current.isLoggedIn).toBe(true);
    });

    it('should set login status to false', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setIsLoggedIn(true);
      });
      act(() => {
        result.current.setIsLoggedIn(false);
      });

      expect(result.current.isLoggedIn).toBe(false);
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple updates', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setTheme('dark');
        result.current.setAgentMode(true);
        result.current.setLocalCurrency('EUR');
        result.current.setUserName('Test User');
        result.current.setIsLoggedIn(true);
      });

      expect(result.current.theme).toBe('dark');
      expect(result.current.agentModeEnabled).toBe(true);
      expect(result.current.localCurrency).toBe('EUR');
      expect(result.current.userName).toBe('Test User');
      expect(result.current.isLoggedIn).toBe(true);
    });

    it('should not affect other state when updating one property', () => {
      const { result } = renderHook(() => useSettingsStore());

      act(() => {
        result.current.setTheme('dark');
        result.current.setAgentMode(true);
      });

      act(() => {
        result.current.setLocalCurrency('GBP');
      });

      // Other state should remain unchanged
      expect(result.current.theme).toBe('dark');
      expect(result.current.agentModeEnabled).toBe(true);
      expect(result.current.localCurrency).toBe('GBP');
    });
  });
});

describe('applyTheme Helper', () => {
  beforeEach(() => {
    mockSetProperty.mockClear();
    mockSetAttribute.mockClear();
  });

  it('should apply light theme CSS variables', () => {
    // Mock system preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
      })),
    });

    applyTheme('light');

    expect(mockSetProperty).toHaveBeenCalledWith('--background', THEME_TOKENS.light.background);
    expect(mockSetProperty).toHaveBeenCalledWith('--foreground', THEME_TOKENS.light.foreground);
    expect(mockSetProperty).toHaveBeenCalledWith('--surface', THEME_TOKENS.light.surface);
    expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'light');
  });

  it('should apply dark theme CSS variables', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
      })),
    });

    applyTheme('dark');

    expect(mockSetProperty).toHaveBeenCalledWith('--background', THEME_TOKENS.dark.background);
    expect(mockSetProperty).toHaveBeenCalledWith('--foreground', THEME_TOKENS.dark.foreground);
    expect(mockSetProperty).toHaveBeenCalledWith('--surface', THEME_TOKENS.dark.surface);
    expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('should apply dark theme for system when prefersDark is true', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: true, // Prefers dark
        media: query,
      })),
    });

    applyTheme('system');

    expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'dark');
  });

  it('should apply light theme for system when prefersDark is false', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false, // Prefers light
        media: query,
      })),
    });

    applyTheme('system');

    expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'light');
  });
});
