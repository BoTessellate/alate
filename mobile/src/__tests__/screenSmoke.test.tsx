/**
 * Screen Smoke Tests
 *
 * Every screen must render without throwing. If a screen throws during render,
 * users see a white screen (or the ErrorBoundary fallback). These tests catch
 * that class of bug at CI time — before it ships.
 *
 * Each test does: render(<Screen />) + assert no crash. That's it. They don't
 * test behavior (other test files do that). They exist as a safety net.
 *
 * If you add a new screen, add a smoke test here. This is enforced by the
 * TDD rule in CLAUDE.md.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// --- Shared mocks (beyond jest.setup.js) ---------------------------------

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: any = {};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
    useRoute: () => ({ params: mockRouteParams }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      const React = require('react');
      React.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('../services/api', () => ({
  scrapeProduct: jest.fn().mockResolvedValue({ success: false }),
  enrichProduct: jest.fn().mockResolvedValue({ success: false }),
  checkFit: jest.fn().mockResolvedValue({ success: true, fit_score: 'great', warnings: [] }),
  nudgeBrand: jest.fn().mockResolvedValue({ success: true }),
  extractBrandFromUrl: jest.fn(() => null),
  calibrateGarment: jest.fn().mockResolvedValue({ success: false }),
}));

jest.mock('../components/FitLoader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, null, 'Loading');
});

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(() => ({ type: 'dismiss' })),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'test://redirect'),
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
}));

jest.mock('expo-crypto', () => ({
  getRandomValues: jest.fn((arr: Uint8Array) => arr),
}));

// --- Imports (after mocks) -----------------------------------------------

import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AccountScreen from '../screens/AccountScreen';
import AvatarSetupScreen from '../screens/AvatarSetupScreen';
import FitResultScreen from '../screens/FitResultScreen';
import PickImageScreen from '../screens/PickImageScreen';
import OverlayEditorScreen from '../screens/OverlayEditorScreen';

import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import { useCalibrationStore } from '../store/calibrationStore';
import { useEditorStore } from '../store/editorStore';

// --- Tests ---------------------------------------------------------------

describe('Screen Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAvatarStore.setState({ avatar: null });
    useFitHistoryStore.setState({ entries: [] });
    useCalibrationStore.setState({ garments: [] });
    useEditorStore.getState().reset();
    mockRouteParams = {};
  });

  it('HomeScreen renders without crashing', () => {
    expect(() => render(<HomeScreen />)).not.toThrow();
  });

  it('HomeScreen renders with avatar set', () => {
    useAvatarStore.setState({
      avatar: {
        height_cm: 168,
        shoulders: 'average',
        bust: 'medium',
        waist: 'average',
        hips: 'average',
        thighs: 'average',
        torso_length: 'average',
      },
    });
    expect(() => render(<HomeScreen />)).not.toThrow();
  });

  it('HistoryScreen renders without crashing (empty state)', () => {
    expect(() => render(<HistoryScreen />)).not.toThrow();
  });

  it('AccountScreen renders without crashing', () => {
    expect(() => render(<AccountScreen />)).not.toThrow();
  });

  it('AvatarSetupScreen renders without crashing', () => {
    expect(() => render(<AvatarSetupScreen />)).not.toThrow();
  });

  it('FitResultScreen renders in history mode without crashing', () => {
    mockRouteParams = {
      product: {
        name: 'Test dress',
        image: 'https://cdn.example.com/a.jpg',
        price: { amount: 49, currency: 'GBP' },
        brand: 'Asos',
      },
      url: 'https://asos.com/p/1',
      historyEntryId: 'h-1',
      precomputed: {
        fitScore: 'great',
        warnings: [],
        sizeRecommendation: { size: 'M', confidence: 'high' },
        enrichedProduct: { category: 'dresses' },
        checkedAt: '2026-01-01T00:00:00.000Z',
      },
    };
    expect(() => render(<FitResultScreen />)).not.toThrow();
  });

  it('FitResultScreen renders in live mode without crashing', () => {
    useAvatarStore.setState({
      avatar: {
        height_cm: 168,
        shoulders: 'average',
        bust: 'medium',
        waist: 'average',
        hips: 'average',
        thighs: 'average',
        torso_length: 'average',
      },
    });
    mockRouteParams = {
      product: { name: 'Test dress' },
      url: 'https://asos.com/p/1',
    };
    expect(() => render(<FitResultScreen />)).not.toThrow();
  });

  it('PickImageScreen renders without crashing', () => {
    expect(() => render(<PickImageScreen />)).not.toThrow();
  });

  it('OverlayEditorScreen renders empty state without crashing', () => {
    // No image seeded — screen should render the "no photo picked" fallback.
    expect(() => render(<OverlayEditorScreen />)).not.toThrow();
  });

  it('OverlayEditorScreen renders with image seeded without crashing', () => {
    useEditorStore.getState().setImage('file:///tmp/seed.jpg');
    useEditorStore.getState().addOverlay('peace');
    expect(() => render(<OverlayEditorScreen />)).not.toThrow();
  });

  it('ScreenErrorBoundary catches render errors and shows fallback', () => {
    const ScreenErrorBoundary = require('../components/ScreenErrorBoundary').default;
    const ThrowingComponent = () => {
      throw new Error('Test crash');
    };
    const { getByText } = render(
      <ScreenErrorBoundary name="TestScreen">
        <ThrowingComponent />
      </ScreenErrorBoundary>
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });
});
