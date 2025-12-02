// Unit tests for urlScraper utility
import { scrapeProductUrl } from './urlScraper';

// Mock fetch globally
global.fetch = jest.fn();

describe('urlScraper', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('scrapeProductUrl', () => {
    it('should successfully scrape product data', async () => {
      const mockResponse = {
        title: 'Test Product',
        brandName: 'Test Brand',
        price: '99.99',
        currency: 'USD',
        imageUrl: 'https://example.com/image.jpg',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await scrapeProductUrl('https://example.com/product');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/scrape'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com/product' }),
        })
      );
    });

    it('should handle ImageObject format and extract URL', async () => {
      const mockResponse = {
        title: 'Test Product',
        brandName: 'Test Brand',
        price: '99.99',
        currency: 'USD',
        imageUrl: {
          '@type': 'ImageObject',
          url: 'https://example.com/image.jpg',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await scrapeProductUrl('https://example.com/product');

      expect(result.imageUrl).toBe('https://example.com/image.jpg');
    });

    it('should handle ImageObject with "image" property', async () => {
      const mockResponse = {
        title: 'Test Product',
        imageUrl: {
          '@type': 'ImageObject',
          image: 'https://example.com/image.jpg',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await scrapeProductUrl('https://example.com/product');

      expect(result.imageUrl).toBe('https://example.com/image.jpg');
    });

    it('should handle ImageObject with "contentUrl" property', async () => {
      const mockResponse = {
        title: 'Test Product',
        imageUrl: {
          '@type': 'ImageObject',
          contentUrl: 'https://example.com/image.jpg',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await scrapeProductUrl('https://example.com/product');

      expect(result.imageUrl).toBe('https://example.com/image.jpg');
    });

    it('should return empty object on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await scrapeProductUrl('https://example.com/product');

      expect(result).toEqual({});
    });

    it('should return empty object on HTTP error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await scrapeProductUrl('https://example.com/product');

      expect(result).toEqual({});
    });

    it('should handle partial data gracefully', async () => {
      const mockResponse = {
        title: 'Test Product',
        // Missing brandName, price, currency, imageUrl
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await scrapeProductUrl('https://example.com/product');

      expect(result.title).toBe('Test Product');
      expect(result.brandName).toBeUndefined();
      expect(result.price).toBeUndefined();
      expect(result.currency).toBeUndefined();
      expect(result.imageUrl).toBeUndefined();
    });

    it('should handle empty response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await scrapeProductUrl('https://example.com/product');

      expect(result).toEqual({});
    });

    it('should use correct backend URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ title: 'Test' }),
      });

      await scrapeProductUrl('https://example.com/product');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('backend-fu5727b1p-ramsaptamis-projects.vercel.app'),
        expect.any(Object)
      );
    });
  });
});
