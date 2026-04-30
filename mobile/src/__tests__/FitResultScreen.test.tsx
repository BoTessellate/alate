/**
 * Component tests: FitResultScreen
 *
 * This screen has two branches the user can hit:
 *
 *   1. "Live" mode — we just scraped a product on HomeScreen and pushed here.
 *      On mount it calls enrichProduct + checkFit, shows a loader, then renders
 *      the score card + size recommendation + action buttons.
 *
 *   2. "History" mode — user tapped a row in HistoryScreen. The precomputed
 *      fit result is passed via route params so no network calls are made.
 *      The primary action becomes "Re-evaluate" which routes to AvatarSetup.
 *
 * Both branches must render the fit-score-display + size-recommendation cards
 * (our E2E happy path relies on those testIDs), and both must not crash when
 * the api calls reject — the captureError path is exercised implicitly.
 *
 * Network is mocked at ../services/api, navigation is stubbed, and Linking
 * is spied so we can assert on openProductPage without actually opening a URL.
 */

import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import FitResultScreen from '../screens/FitResultScreen';
import { useAvatarStore } from '../store/avatarStore';
import { useFitHistoryStore } from '../store/fitHistoryStore';
import { useCalibrationStore } from '../store/calibrationStore';
import * as api from '../services/api';

// --- Mocks ---------------------------------------------------------------

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: any = {};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
    useRoute: () => ({ params: mockRouteParams }),
    // Fire focus effect as a regular useEffect so re-eval flow can be tested.
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
  enrichProduct: jest.fn(),
  checkFit: jest.fn(),
  scrapeProduct: jest.fn(),
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));

// FitLoader renders a native ActivityIndicator wrapper; stub for simpler tree.
jest.mock('../components/FitLoader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, { testID: 'fit-loader' }, 'Loading…');
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
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

const LIVE_PARAMS = {
  product: {
    name: 'Linen shirt',
    image: 'https://cdn.example.com/a.jpg',
    price: { amount: 49, currency: 'GBP' },
    brand: 'Asos',
  },
  url: 'https://asos.com/p/1',
};

const HISTORY_PARAMS = {
  product: {
    name: 'Denim jacket',
    image: 'https://cdn.example.com/b.jpg',
    price: { amount: 89, currency: 'GBP' },
    brand: 'Zara',
  },
  url: 'https://zara.com/p/2',
  historyEntryId: 'h-123',
  precomputed: {
    fitScore: 'great' as const,
    warnings: [],
    sizeRecommendation: {
      size: 'M',
      confidence: 'high' as const,
    },
    enrichedProduct: {
      category: 'jackets',
      material: 'denim',
      tags: ['casual'],
    },
    checkedAt: '2026-01-15T10:00:00.000Z',
  },
};

// --- Tests ---------------------------------------------------------------

describe('FitResultScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAvatarStore.setState({ avatar: AVATAR });
    useFitHistoryStore.setState({ entries: [] });
    useCalibrationStore.setState({ garments: [] });
  });

  // ------------------------------------------------------------------
  // History mode — precomputed, no network
  // ------------------------------------------------------------------
  describe('history mode', () => {
    beforeEach(() => {
      mockRouteParams = HISTORY_PARAMS;
    });

    it('renders without calling the network', async () => {
      const { findByTestId } = render(<FitResultScreen />);
      await findByTestId('fit-score-display');
      expect(api.enrichProduct).not.toHaveBeenCalled();
      expect(api.checkFit).not.toHaveBeenCalled();
    });

    it('shows the precomputed score label and recommended size', async () => {
      const { findByTestId, getAllByLabelText } = render(<FitResultScreen />);
      await findByTestId('fit-score-label');
      // Verdict is now rendered as a TAN Nightingale SVG via HeadingImage;
      // the human-readable label lives on the wrapper's accessibilityLabel
      // so screen readers + tests can still locate it.
      expect(getAllByLabelText('Great Fit!').length).toBeGreaterThan(0);
      const sizeValue = await findByTestId('recommended-size-value');
      expect(sizeValue).toBeTruthy();
      expect(sizeValue.props.children).toBe('M');
    });

    it('shows the history-mode action buttons', async () => {
      const { findByTestId } = render(<FitResultScreen />);
      await findByTestId('reevaluate-button');
      await findByTestId('change-measurements-button');
      await findByTestId('view-on-store-button');
    });

    it('re-evaluate button re-scrapes + re-runs checkFit IN PLACE (no AvatarSetup nav)', async () => {
      // Re-evaluate now stays on the FitResult screen and refreshes
      // the data directly from the product URL + current avatar. Per
      // user feedback April 29 2026: "re-evalute should ideally only
      // hit the product URL" — going via AvatarSetup felt round-about
      // when "Change your measurements" already exists for that path.
      (api.scrapeProduct as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: {
          name: 'Black Midi Dress',
          image: 'https://example.com/img.jpg',
          price: { amount: 49, currency: 'GBP' },
          brand: 'ASOS',
        },
      });
      (api.checkFit as jest.Mock).mockResolvedValueOnce({
        success: true,
        fit_score: 'moderate',
        warnings: [{ severity: 'minor', message: 'snug at waist' }],
        size_recommendation: { size: 'M', confidence: 'high' },
      });

      const { findByTestId } = render(<FitResultScreen />);
      const btn = await findByTestId('reevaluate-button');
      fireEvent.press(btn);

      await waitFor(() => {
        // The fixture URL is whatever HISTORY_PARAMS / activeEntry has.
        expect(api.scrapeProduct).toHaveBeenCalled();
        expect(api.checkFit).toHaveBeenCalled();
      });
      // Should NOT navigate anywhere — stays on FitResult.
      expect(mockNavigate).not.toHaveBeenCalledWith('AvatarSetup');
    });

    it('change measurements button routes to AvatarSetup', async () => {
      const { findByTestId } = render(<FitResultScreen />);
      const btn = await findByTestId('change-measurements-button');
      fireEvent.press(btn);
      expect(mockNavigate).toHaveBeenCalledWith('AvatarSetup');
    });
  });

  // ------------------------------------------------------------------
  // Live mode — network-driven
  // ------------------------------------------------------------------
  describe('live mode', () => {
    beforeEach(() => {
      mockRouteParams = LIVE_PARAMS;
    });

    it('shows the loader before the fit call resolves', () => {
      (api.enrichProduct as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );
      (api.checkFit as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );
      const { getByTestId } = render(<FitResultScreen />);
      expect(getByTestId('fit-loader')).toBeTruthy();
    });

    it('renders the score + size card after successful checkFit', async () => {
      (api.enrichProduct as jest.Mock).mockResolvedValueOnce({
        success: true,
        product: {
          id: 'p-1',
          name: 'Linen shirt',
          category: 'shirts',
          material: 'linen',
          tags: ['summer'],
        },
      });
      (api.checkFit as jest.Mock).mockResolvedValueOnce({
        success: true,
        fit_score: 'great',
        warnings: [],
        size_recommendation: { size: 'S', confidence: 'high' },
      });

      const { findByTestId } = render(<FitResultScreen />);
      await findByTestId('fit-score-display');
      const sizeValue = await findByTestId('recommended-size-value');
      expect(sizeValue.props.children).toBe('S');
    });

    it('adds a history entry on successful fit check', async () => {
      (api.enrichProduct as jest.Mock).mockResolvedValueOnce({
        success: true,
        product: { id: 'p-1', name: 'Linen shirt', category: 'shirts' },
      });
      (api.checkFit as jest.Mock).mockResolvedValueOnce({
        success: true,
        fit_score: 'great',
        warnings: [],
        size_recommendation: { size: 'S', confidence: 'high' },
      });

      const { findByTestId } = render(<FitResultScreen />);
      await findByTestId('fit-score-display');

      await waitFor(() => {
        expect(useFitHistoryStore.getState().entries.length).toBe(1);
      });
      const entry = useFitHistoryStore.getState().entries[0];
      expect(entry.url).toBe('https://asos.com/p/1');
      expect(entry.productName).toBe('Linen shirt');
      expect(entry.fitScore).toBe('great');
    });

    it('does not crash if enrichProduct rejects', async () => {
      (api.enrichProduct as jest.Mock).mockRejectedValueOnce(new Error('enrich down'));
      (api.checkFit as jest.Mock).mockResolvedValueOnce({
        success: true,
        fit_score: 'moderate',
        // Severity must be 'moderate' so the verdict stays at the
        // "Some Concerns" tier. April 29 2026 the FIT badge derives
        // from MAX warning severity (effectiveScore) rather than the
        // raw fit_score string — a 'moderate' fit_score with only
        // 'minor' warnings re-tiers to "Great Fit, with a note".
        // Keeping the test focused on the moderate verdict path.
        warnings: [{ severity: 'moderate', message: 'Sleeves run long for your shoulders' }],
      });

      const { findByTestId, getAllByLabelText } = render(<FitResultScreen />);
      await findByTestId('fit-score-display');
      // Verdict label now lives on the HeadingImage wrapper's
      // accessibilityLabel, not a raw Text node.
      expect(getAllByLabelText('Some Concerns').length).toBeGreaterThan(0);
    });

    it('a `moderate` fit_score with ONLY minor warnings re-tiers to "Great Fit, with a note"', async () => {
      // Regression: backend marks any non-empty warnings as 'moderate'
      // but a single minor concern shouldn't trigger the warning
      // triangle. Mobile derives effectiveScore from max severity.
      (api.enrichProduct as jest.Mock).mockResolvedValueOnce({
        success: true,
        product: { id: 'p-1', name: 'Linen shirt' },
      });
      (api.checkFit as jest.Mock).mockResolvedValueOnce({
        success: true,
        fit_score: 'moderate',
        warnings: [{ severity: 'minor', message: 'A-line styles add hip volume' }],
        size_recommendation: { size: 'M', confidence: 'high' },
      });

      const { findByTestId, getAllByLabelText } = render(<FitResultScreen />);
      await findByTestId('fit-score-display');
      expect(getAllByLabelText('Great Fit, with a note').length).toBeGreaterThan(0);
    });

    it('renders live-mode action buttons', async () => {
      (api.enrichProduct as jest.Mock).mockResolvedValueOnce({
        success: true,
        product: { id: 'p-1', name: 'Linen shirt' },
      });
      (api.checkFit as jest.Mock).mockResolvedValueOnce({
        success: true,
        fit_score: 'great',
        warnings: [],
      });

      const { findByTestId, queryByTestId } = render(<FitResultScreen />);
      await findByTestId('view-on-store-button');
      await findByTestId('check-another-button');
      // Live mode must NOT show re-evaluate / change measurements buttons.
      expect(queryByTestId('reevaluate-button')).toBeNull();
      expect(queryByTestId('change-measurements-button')).toBeNull();
    });

    it('view-on-store button opens the product url', async () => {
      const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

      (api.enrichProduct as jest.Mock).mockResolvedValueOnce({
        success: true,
        product: { id: 'p-1', name: 'Linen shirt' },
      });
      (api.checkFit as jest.Mock).mockResolvedValueOnce({
        success: true,
        fit_score: 'great',
        warnings: [],
      });

      const { findByTestId } = render(<FitResultScreen />);
      const btn = await findByTestId('view-on-store-button');
      fireEvent.press(btn);
      expect(openUrlSpy).toHaveBeenCalledWith('https://asos.com/p/1');
      openUrlSpy.mockRestore();
    });

    it('check-another button calls navigation.goBack', async () => {
      (api.enrichProduct as jest.Mock).mockResolvedValueOnce({
        success: true,
        product: { id: 'p-1', name: 'Linen shirt' },
      });
      (api.checkFit as jest.Mock).mockResolvedValueOnce({
        success: true,
        fit_score: 'great',
        warnings: [],
      });

      const { findByTestId } = render(<FitResultScreen />);
      const btn = await findByTestId('check-another-button');
      fireEvent.press(btn);
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('does not crash when checkFit rejects — loader ends, no history entry', async () => {
      (api.enrichProduct as jest.Mock).mockResolvedValueOnce({
        success: true,
        product: { id: 'p-1', name: 'Linen shirt' },
      });
      (api.checkFit as jest.Mock).mockRejectedValueOnce(new Error('boom'));

      const { queryByTestId } = render(<FitResultScreen />);
      await waitFor(() => {
        expect(queryByTestId('fit-loader')).toBeNull();
      });
      expect(useFitHistoryStore.getState().entries.length).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Delete-from-fit-analysis — regression guard.
  //
  // User reported: deleting the current item via the top-right trash
  // icon should NOT bounce you back to History when there are sibling
  // entries to show. Previously we called navigation.goBack() after
  // every deletion; now we filter the local siblings list and stay on
  // the screen if any remain, only going back when we deleted the
  // last one.
  // ------------------------------------------------------------------
  describe('delete from fit analysis', () => {
    const SIBLING_ENTRIES = [
      {
        id: 'h-1', url: 'https://asos.com/p/1', productName: 'Linen shirt',
        productImage: 'https://cdn.example.com/a.jpg', brand: 'Asos',
        fitScore: 'great' as const, warnings: [], checkedAt: '2026-01-15T10:00:00Z',
        sizeRecommendation: { size: 'M', confidence: 'high' as const },
      },
      {
        id: 'h-2', url: 'https://zara.com/p/2', productName: 'Denim jacket',
        productImage: 'https://cdn.example.com/b.jpg', brand: 'Zara',
        fitScore: 'moderate' as const, warnings: [], checkedAt: '2026-01-15T11:00:00Z',
        sizeRecommendation: { size: 'S', confidence: 'medium' as const },
      },
    ];

    it('stays on the screen and moves to the next sibling when siblings remain', async () => {
      // History mode with 2 siblings — delete the first → second should
      // still render, no goBack call.
      mockRouteParams = {
        product: {
          name: SIBLING_ENTRIES[0].productName,
          image: SIBLING_ENTRIES[0].productImage,
          brand: SIBLING_ENTRIES[0].brand,
        },
        url: SIBLING_ENTRIES[0].url,
        historyEntryId: SIBLING_ENTRIES[0].id,
        precomputed: {
          fitScore: 'great',
          warnings: [],
          sizeRecommendation: SIBLING_ENTRIES[0].sizeRecommendation,
        },
        historyEntries: SIBLING_ENTRIES,
        currentIndex: 0,
      };
      useFitHistoryStore.setState({ entries: SIBLING_ENTRIES });

      const { findByTestId } = render(<FitResultScreen />);
      // Tap the trash icon — opens the themed ConfirmDialog modal
      // (replaced the native Alert popup in April 2026).
      const trash = await findByTestId('remove-from-history-button');
      fireEvent.press(trash);

      // Then tap the modal's Remove button to confirm.
      const confirmBtn = await findByTestId('confirm-delete-fit-entry');
      fireEvent.press(confirmBtn);

      // Deleted from the store + stayed on screen (no goBack).
      expect(useFitHistoryStore.getState().entries.find((e) => e.id === 'h-1')).toBeUndefined();
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it('goes back when the deleted item was the only sibling', async () => {
      const SOLO = [SIBLING_ENTRIES[0]];
      mockRouteParams = {
        product: {
          name: SOLO[0].productName,
          image: SOLO[0].productImage,
          brand: SOLO[0].brand,
        },
        url: SOLO[0].url,
        historyEntryId: SOLO[0].id,
        precomputed: {
          fitScore: 'great',
          warnings: [],
          sizeRecommendation: SOLO[0].sizeRecommendation,
        },
        historyEntries: SOLO,
        currentIndex: 0,
      };
      useFitHistoryStore.setState({ entries: SOLO });

      const { findByTestId } = render(<FitResultScreen />);
      const trash = await findByTestId('remove-from-history-button');
      fireEvent.press(trash);

      const confirmBtn = await findByTestId('confirm-delete-fit-entry');
      fireEvent.press(confirmBtn);

      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
