/**
 * INTEGRATION TEST: First-Time User Journey
 *
 * Critical Path:
 *   Share URL → App detects no avatar → Store pending URL
 *   → Avatar setup → Scrape → Enrich → Check Fit → History entry
 *
 * This test scaffolds the most important first-time user flow.
 * It exercises: avatarStore, pendingShareStore, fitHistoryStore, and all 3 AI APIs.
 *
 * TODO: Add assertions for edge cases (network failures, partial data, etc.)
 */

import { useAvatarStore, Avatar } from '../../store/avatarStore';
import { usePendingShareStore } from '../../store/pendingShareStore';
import { useFitHistoryStore } from '../../store/fitHistoryStore';
import * as api from '../../services/api';

// Mock the API layer
jest.mock('../../services/api', () => ({
  scrapeProduct: jest.fn(),
  enrichProduct: jest.fn(),
  checkFit: jest.fn(),
  extractBrandFromUrl: jest.requireActual('../../services/api').extractBrandFromUrl,
}));

const mockApi = api as jest.Mocked<typeof api>;

// Test fixtures
const TEST_URL = 'https://asos.com/dress/test-123';

const TEST_AVATAR: Avatar = {
  height_cm: 170,
  shoulders: 'average',
  bust: 'large',
  waist: 'defined',
  hips: 'wide',
  thighs: 'average',
  torso_length: 'average',
};

const MOCK_SCRAPE_SUCCESS = {
  success: true,
  data: {
    name: 'Floral Midi Dress',
    image: 'https://example.com/dress.jpg',
    price: { amount: 79.99, currency: 'GBP' },
    brand: 'ASOS',
  },
};

const MOCK_ENRICH_SUCCESS = {
  success: true,
  product: {
    id: 'p-1',
    name: 'Floral Midi Dress',
    category: 'dress',
    material: 'polyester',
    tags: ['midi', 'floral', 'summer'],
  },
};

const MOCK_FIT_SUCCESS = {
  success: true,
  warnings: [],
  fit_score: 'great' as const,
  size_recommendation: {
    size: 'M',
    confidence: 'high' as const,
    note: 'True to size',
  },
};

describe('First-Time User Journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all stores to clean state
    useAvatarStore.setState({ avatar: null });
    usePendingShareStore.setState({ pendingUrl: null });
    useFitHistoryStore.setState({ entries: [] });
  });

  describe('Step 1: Share URL without avatar', () => {
    it('should store URL as pending when avatar missing', () => {
      expect(useAvatarStore.getState().avatar).toBeNull();

      usePendingShareStore.getState().setPendingUrl(TEST_URL);

      expect(usePendingShareStore.getState().pendingUrl).toBe(TEST_URL);
    });

    it('should NOT trigger any API calls when avatar is missing', () => {
      usePendingShareStore.getState().setPendingUrl(TEST_URL);

      expect(mockApi.scrapeProduct).not.toHaveBeenCalled();
      expect(mockApi.enrichProduct).not.toHaveBeenCalled();
      expect(mockApi.checkFit).not.toHaveBeenCalled();
    });
  });

  describe('Step 2: User completes avatar setup', () => {
    beforeEach(() => {
      usePendingShareStore.getState().setPendingUrl(TEST_URL);
    });

    it('should persist avatar after setup', () => {
      useAvatarStore.getState().setAvatar(TEST_AVATAR);

      const stored = useAvatarStore.getState().avatar;
      expect(stored).toEqual(TEST_AVATAR);
      expect(stored?.height_cm).toBe(170);
    });

    it('should keep pendingUrl intact while avatar is being set up', () => {
      useAvatarStore.getState().setAvatar(TEST_AVATAR);

      expect(usePendingShareStore.getState().pendingUrl).toBe(TEST_URL);
    });
  });

  describe('Step 3: Run fit check chain (scrape → enrich → checkFit)', () => {
    beforeEach(() => {
      useAvatarStore.getState().setAvatar(TEST_AVATAR);
      usePendingShareStore.getState().setPendingUrl(TEST_URL);
    });

    it('should call scrapeProduct with the pending URL', async () => {
      mockApi.scrapeProduct.mockResolvedValue(MOCK_SCRAPE_SUCCESS);

      const result = await api.scrapeProduct(TEST_URL);

      expect(mockApi.scrapeProduct).toHaveBeenCalledWith(TEST_URL);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Floral Midi Dress');
    });

    it('should chain scrape → enrich → checkFit with correct data', async () => {
      mockApi.scrapeProduct.mockResolvedValue(MOCK_SCRAPE_SUCCESS);
      mockApi.enrichProduct.mockResolvedValue(MOCK_ENRICH_SUCCESS);
      mockApi.checkFit.mockResolvedValue(MOCK_FIT_SUCCESS);

      const scraped = await api.scrapeProduct(TEST_URL);
      expect(scraped.success).toBe(true);

      const enriched = await api.enrichProduct({
        name: scraped.data!.name!,
        image_url: scraped.data!.image,
        price: scraped.data!.price?.amount,
        currency: scraped.data!.price?.currency,
      });
      expect(enriched.success).toBe(true);
      expect(enriched.product?.category).toBe('dress');

      const fit = await api.checkFit(
        {
          id: enriched.product!.id!,
          product_name: enriched.product!.name,
          category: enriched.product!.category!,
          material: enriched.product!.material,
          tags: enriched.product!.tags,
        },
        TEST_AVATAR
      );

      expect(fit.fit_score).toBe('great');
      expect(fit.size_recommendation?.size).toBe('M');
    });

    // TODO: Test error handling for each API step
    // TODO: Test partial data scenarios (missing price, missing image)
  });

  describe('Step 4: Save to history and clear pending URL', () => {
    beforeEach(() => {
      useAvatarStore.getState().setAvatar(TEST_AVATAR);
      usePendingShareStore.getState().setPendingUrl(TEST_URL);
    });

    it('should add entry to fit history (id auto-generated)', () => {
      const historyStore = useFitHistoryStore.getState();

      historyStore.addEntry({
        url: TEST_URL,
        productName: 'Floral Midi Dress',
        fitScore: 'great',
        warnings: [],
        checkedAt: new Date().toISOString(),
        sizeRecommendation: MOCK_FIT_SUCCESS.size_recommendation,
        category: 'dress',
        material: 'polyester',
        tags: ['midi', 'floral', 'summer'],
        price: { amount: 79.99, currency: 'GBP' },
        brand: 'ASOS',
      });

      const entries = useFitHistoryStore.getState().entries;
      expect(entries).toHaveLength(1);
      expect(entries[0].productName).toBe('Floral Midi Dress');
      expect(entries[0].id).toBeDefined();
    });

    it('should clear pending URL after successful flow', () => {
      usePendingShareStore.getState().clearPendingUrl();

      expect(usePendingShareStore.getState().pendingUrl).toBeNull();
    });
  });
});
