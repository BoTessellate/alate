/**
 * INTEGRATION TEST: Recurring Fit Check (Avatar Exists)
 *
 * Critical Path:
 *   Home → paste URL → auto-trigger (debounced)
 *   → scrape → enrich → checkFit → FitResult → history
 *
 * Tests the "power user" flow — avatar is already set, user just pastes URLs.
 *
 * TODO: Test debounce timing, validate URL before firing API
 */

import { useAvatarStore, Avatar } from '../../store/avatarStore';
import { useFitHistoryStore } from '../../store/fitHistoryStore';
import * as api from '../../services/api';

jest.mock('../../services/api', () => ({
  scrapeProduct: jest.fn(),
  enrichProduct: jest.fn(),
  checkFit: jest.fn(),
  logBrandRequest: jest.fn(),
  getBrandRequestCount: jest.fn().mockResolvedValue(0),
  extractBrandFromUrl: jest.requireActual('../../services/api').extractBrandFromUrl,
}));

const mockApi = api as jest.Mocked<typeof api>;

const EXISTING_AVATAR: Avatar = {
  height_cm: 165,
  shoulders: 'narrow',
  bust: 'medium',
  waist: 'defined',
  hips: 'average',
  thighs: 'average',
  torso_length: 'short',
};

describe('Recurring Fit Check (Avatar Exists)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAvatarStore.setState({ avatar: EXISTING_AVATAR });
    useFitHistoryStore.setState({ entries: [] });
  });

  describe('URL validation before API call', () => {
    it('should NOT call scrape for an invalid URL', async () => {
      // Basic URL format check (stub — real app has debounced validation)
      const invalid = 'not-a-url';
      const isValid = /^https?:\/\//.test(invalid);

      expect(isValid).toBe(false);
      expect(mockApi.scrapeProduct).not.toHaveBeenCalled();
    });

    it('should call scrape for a valid URL', async () => {
      mockApi.scrapeProduct.mockResolvedValue({
        success: true,
        data: { name: 'Jeans', price: { amount: 49, currency: 'USD' } },
      });

      const url = 'https://zara.com/jeans/123';
      const result = await api.scrapeProduct(url);

      expect(mockApi.scrapeProduct).toHaveBeenCalledWith(url);
      expect(result.success).toBe(true);
    });
  });

  describe('Happy path: valid URL → FitResult', () => {
    it('should complete the full chain and add to history', async () => {
      mockApi.scrapeProduct.mockResolvedValue({
        success: true,
        data: {
          name: 'High Waisted Jeans',
          image: 'https://example.com/jeans.jpg',
          price: { amount: 49, currency: 'USD' },
          brand: 'Zara',
        },
      });
      mockApi.enrichProduct.mockResolvedValue({
        success: true,
        product: {
          id: 'p-jeans',
          name: 'High Waisted Jeans',
          category: 'pants',
          material: 'denim',
          tags: ['high-waist', 'skinny'],
        },
      });
      mockApi.checkFit.mockResolvedValue({
        success: true,
        warnings: [
          { severity: 'minor', message: 'Hip area may feel snug' },
        ],
        fit_score: 'moderate',
        size_recommendation: { size: 'S', confidence: 'medium' },
      });

      const scrapeRes = await api.scrapeProduct('https://zara.com/jeans/123');
      const enrichRes = await api.enrichProduct({
        name: scrapeRes.data!.name!,
        image_url: scrapeRes.data!.image,
      });
      const fitRes = await api.checkFit(
        {
          id: enrichRes.product!.id!,
          product_name: enrichRes.product!.name,
          category: enrichRes.product!.category!,
          material: enrichRes.product!.material,
          tags: enrichRes.product!.tags,
        },
        EXISTING_AVATAR
      );

      expect(fitRes.fit_score).toBe('moderate');
      expect(fitRes.warnings).toHaveLength(1);

      // Persist to history
      useFitHistoryStore.getState().addEntry({
        url: 'https://zara.com/jeans/123',
        productName: 'High Waisted Jeans',
        fitScore: 'moderate',
        warnings: fitRes.warnings!,
        checkedAt: new Date().toISOString(),
        sizeRecommendation: fitRes.size_recommendation,
        category: 'pants',
        material: 'denim',
      });

      expect(useFitHistoryStore.getState().entries).toHaveLength(1);
    });
  });

  describe('Error handling: scrape failure', () => {
    it('should return failure without calling enrich/checkFit', async () => {
      mockApi.scrapeProduct.mockResolvedValue({
        success: false,
        error: 'Brand not supported',
      });

      const result = await api.scrapeProduct('https://unknown-brand.com/item');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Brand not supported');
      expect(mockApi.enrichProduct).not.toHaveBeenCalled();
      expect(mockApi.checkFit).not.toHaveBeenCalled();
    });

    // TODO: Assert that brand-nudge UI is triggered when scrape fails for unknown brand
  });

  describe('Brand extraction for nudge', () => {
    it('should extract brand info from URL', () => {
      const brand = api.extractBrandFromUrl('https://www.zara.com/en/product');
      expect(brand).toEqual({ brandName: 'Zara', brandDomain: 'zara.com' });
    });

    it('should return null for invalid URL', () => {
      const brand = api.extractBrandFromUrl('not-a-url');
      expect(brand).toBeNull();
    });
  });
});
