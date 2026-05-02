/**
 * Component tests: HomeScreen
 *
 * The home screen is the main funnel entry — if it breaks, the whole app
 * looks broken to a user. These tests cover the user-visible branches:
 *
 *   - Empty state (no avatar) shows the "Set up your body profile" card
 *   - Valid URL + avatar → scrapeProduct call → navigate to FitResult
 *   - (scrapeProduct failure / brand-nudge UX moved to FitResultScreen
 *      after the single-loader refactor — covered there, not here.)
 *   - Empty input → inline validation error
 *   - No avatar → tapping Check Fit routes to AvatarSetup
 *
 * We mock services/api (network) and @react-navigation/native (navigate)
 * so the tests run fully offline and don't need a real navigator mount.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import HomeScreen from '../screens/HomeScreen';
import { useAvatarStore } from '../store/avatarStore';
import * as api from '../services/api';

// --- Mocks ---------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    // Fire effect immediately so focus-effect state-reset logic runs in tests.
    useFocusEffect: (cb: () => void | (() => void)) => {
      const React = require('react');
      React.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

jest.mock('../services/api', () => ({
  scrapeProduct: jest.fn(),
  logBrandRequest: jest.fn(),
  getBrandRequestCount: jest.fn().mockResolvedValue(0),
  extractBrandFromUrl: jest.fn((url: string) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      const name = host.split('.')[0];
      return {
        brandName: name.charAt(0).toUpperCase() + name.slice(1),
        brandDomain: host,
      };
    } catch {
      return null;
    }
  }),
}));

// safe-area inset hook — return zeros for test env.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Quieten @expo/vector-icons in the test renderer.
jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
}));

// FitLoader instantiates a Reanimated withRepeat → Easing.linear, which
// isn't fully mocked in the jest harness. HomeScreen now renders the
// loader full-screen while a scrape is in flight (per UX change in
// April 2026). Stub the component out so these tests can render the
// pre-loading state without pulling reanimated internals.
jest.mock('../components/FitLoader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, { testID: 'fit-loader-stub' }, 'Loading…');
});

// --- Helpers -------------------------------------------------------------

const AVATAR = {
  height_cm: 168,
  shoulders: 'average' as const,
  bust: 'medium' as const,
  waist: 'average' as const,
  hips: 'average' as const,
  thighs: 'average' as const,
  torso_length: 'average' as const,
};

function setAvatar(set: boolean) {
  if (set) {
    useAvatarStore.setState({ avatar: AVATAR });
  } else {
    useAvatarStore.setState({ avatar: null });
  }
}

// --- Tests ---------------------------------------------------------------

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    setAvatar(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the set-up-profile prompt when no avatar exists', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Set up your body profile')).toBeTruthy();
  });

  it('does not show the profile prompt once avatar is saved', () => {
    setAvatar(true);
    const { queryByText } = render(<HomeScreen />);
    expect(queryByText('Set up your body profile')).toBeNull();
  });

  // The Check Fit button was removed in favour of the 700ms paste-
  // debounce auto-trigger. The empty-input validation error is gone
  // along with it (no submit path to validate anything against).
  // Navigation tests below exercise the same flow via the auto-trigger.

  it('routes to AvatarSetup when avatar missing + URL pasted', async () => {
    const { getByTestId } = render(<HomeScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId('url-input'), 'https://asos.com/p/1');
    });
    await act(async () => {
      jest.advanceTimersByTime(750);
    });
    expect(mockNavigate).toHaveBeenCalledWith('AvatarSetup');
  });

  it('auto-triggers navigation after 700ms debounce when user pastes a valid URL', async () => {
    setAvatar(true);
    const { getByTestId } = render(<HomeScreen />);
    fireEvent.changeText(getByTestId('url-input'), 'https://zara.com/p/1');

    // Before debounce fires nothing should have happened.
    expect(mockNavigate).not.toHaveBeenCalledWith('FitResult', expect.anything());

    await act(async () => {
      jest.advanceTimersByTime(750);
    });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        'FitResult',
        expect.objectContaining({ url: 'https://zara.com/p/1' })
      )
    );
    // No scrape call from HomeScreen — that lives in FitResult now.
    expect(api.scrapeProduct).not.toHaveBeenCalled();
  });
});
