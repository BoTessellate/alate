/**
 * Component tests: HomeScreen
 *
 * The home screen is the main funnel entry — if it breaks, the whole app
 * looks broken to a user. These tests cover the user-visible branches:
 *
 *   - Empty state (no avatar) shows the "Set up your body profile" card
 *   - Valid URL + avatar → scrapeProduct call → navigate to FitResult
 *   - scrapeProduct failure → brand-nudge card renders
 *   - Nudge button → calls nudgeBrand + flips to confirmation copy
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
  nudgeBrand: jest.fn(),
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

  it('shows inline error when user taps Check Fit with empty input', () => {
    setAvatar(true);
    const { getByTestId, getByText } = render(<HomeScreen />);
    fireEvent.press(getByTestId('check-fit-button'));
    expect(getByText('Please enter a product URL')).toBeTruthy();
  });

  it('routes to AvatarSetup if no avatar is configured', () => {
    const { getByTestId } = render(<HomeScreen />);
    fireEvent.changeText(getByTestId('url-input'), 'https://asos.com/p/1');
    fireEvent.press(getByTestId('check-fit-button'));
    expect(mockNavigate).toHaveBeenCalledWith('AvatarSetup');
  });

  it('scrapes and navigates to FitResult on success', async () => {
    setAvatar(true);
    (api.scrapeProduct as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        name: 'Linen shirt',
        image: 'https://cdn.example.com/a.jpg',
        price: { amount: 49, currency: 'GBP' },
        brand: 'Asos',
      },
    });

    const { getByTestId } = render(<HomeScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId('url-input'), 'https://asos.com/p/1');
    });
    await act(async () => {
      fireEvent.press(getByTestId('check-fit-button'));
    });
    // Drain the scrapeProduct promise microtask chain.
    await act(async () => {
      await Promise.resolve();
    });

    expect(api.scrapeProduct).toHaveBeenCalledWith('https://asos.com/p/1');
    expect(mockNavigate).toHaveBeenCalledWith(
      'FitResult',
      expect.objectContaining({
        url: 'https://asos.com/p/1',
        product: expect.objectContaining({ name: 'Linen shirt' }),
      })
    );
  });

  it('renders brand nudge card when scrape fails', async () => {
    setAvatar(true);
    (api.scrapeProduct as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'Brand not supported',
    });

    const { getByTestId, findByTestId, getByText } = render(<HomeScreen />);
    fireEvent.changeText(getByTestId('url-input'), 'https://obscurebrand.com/p/1');
    fireEvent.press(getByTestId('check-fit-button'));

    await findByTestId('brand-nudge-card');
    expect(getByText(/Obscurebrand isn't on our platform yet/i)).toBeTruthy();
    // Navigation to FitResult must NOT fire on failure.
    expect(mockNavigate).not.toHaveBeenCalledWith('FitResult', expect.anything());
  });

  it('sends a brand nudge and swaps to the thank-you copy', async () => {
    setAvatar(true);
    (api.scrapeProduct as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'Brand not supported',
    });
    (api.nudgeBrand as jest.Mock).mockResolvedValueOnce({ success: true });

    const { getByTestId, findByTestId, findByText } = render(<HomeScreen />);
    fireEvent.changeText(getByTestId('url-input'), 'https://obscurebrand.com/p/1');
    fireEvent.press(getByTestId('check-fit-button'));

    await findByTestId('nudge-brand-button');
    fireEvent.press(getByTestId('nudge-brand-button'));

    await findByText(/We've reached out to Obscurebrand/i);
    expect(api.nudgeBrand).toHaveBeenCalledWith('obscurebrand.com', 'Obscurebrand');
  });

  it('surfaces a generic error if scrapeProduct throws', async () => {
    setAvatar(true);
    (api.scrapeProduct as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const { getByTestId, findByTestId } = render(<HomeScreen />);
    fireEvent.changeText(getByTestId('url-input'), 'https://asos.com/p/1');
    fireEvent.press(getByTestId('check-fit-button'));

    // The nudge card renders because HomeScreen's catch falls back to
    // extractBrandFromUrl + a brand-nudge CTA.
    await findByTestId('brand-nudge-card');
  });

  it('auto-triggers scrape after 700ms debounce when user pastes a valid URL', async () => {
    setAvatar(true);
    (api.scrapeProduct as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { name: 'Dress' },
    });

    const { getByTestId } = render(<HomeScreen />);
    fireEvent.changeText(getByTestId('url-input'), 'https://zara.com/p/1');

    // Before debounce fires nothing should have happened.
    expect(api.scrapeProduct).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(750);
    });

    await waitFor(() => expect(api.scrapeProduct).toHaveBeenCalledWith('https://zara.com/p/1'));
  });
});
