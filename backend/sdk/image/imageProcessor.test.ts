/**
 * Image Processor Tests
 * Tests for image processing, resizing, and validation
 */

import {
  generateStoragePath,
  generateImageUrls,
  validateImage,
  estimateProcessingTime,
  IMAGE_SIZE_DIMENSIONS
} from './index';
import { ImageMetadata } from './types';

// Mock sharp for unit tests (actual image processing tested in integration tests)
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    metadata: jest.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg'
    }),
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image'))
  }));
});

describe('Image Processor', () => {
  describe('generateStoragePath', () => {
    it('should generate correct path for original', () => {
      const path = generateStoragePath('brand-123', 'product-456', 'original');
      expect(path).toBe('products/brand-123/product-456/original.jpg');
    });

    it('should generate correct path for thumb', () => {
      const path = generateStoragePath('brand-123', 'product-456', 'thumb');
      expect(path).toBe('products/brand-123/product-456/thumb.jpg');
    });

    it('should generate correct path for preview', () => {
      const path = generateStoragePath('brand-123', 'product-456', 'preview');
      expect(path).toBe('products/brand-123/product-456/preview.jpg');
    });

    it('should generate correct path for large', () => {
      const path = generateStoragePath('brand-123', 'product-456', 'large');
      expect(path).toBe('products/brand-123/product-456/large.jpg');
    });
  });

  describe('generateImageUrls', () => {
    const cdnBaseUrl = 'https://cdn.example.com';

    it('should generate all image URLs', () => {
      const urls = generateImageUrls(cdnBaseUrl, 'brand-123', 'product-456');

      expect(urls.original).toBe('https://cdn.example.com/products/brand-123/product-456/original.jpg');
      expect(urls.thumb).toBe('https://cdn.example.com/products/brand-123/product-456/thumb.jpg');
      expect(urls.preview).toBe('https://cdn.example.com/products/brand-123/product-456/preview.jpg');
      expect(urls.large).toBe('https://cdn.example.com/products/brand-123/product-456/large.jpg');
    });

    it('should handle trailing slash in CDN URL', () => {
      const urls = generateImageUrls('https://cdn.example.com/', 'brand-1', 'prod-1');

      expect(urls.original).toBe('https://cdn.example.com/products/brand-1/prod-1/original.jpg');
    });
  });

  describe('IMAGE_SIZE_DIMENSIONS', () => {
    it('should have correct dimensions', () => {
      expect(IMAGE_SIZE_DIMENSIONS.thumb).toBe(256);
      expect(IMAGE_SIZE_DIMENSIONS.preview).toBe(768);
      expect(IMAGE_SIZE_DIMENSIONS.large).toBe(1440);
    });
  });

  describe('estimateProcessingTime', () => {
    it('should estimate based on pixel count', () => {
      const metadata: ImageMetadata = {
        width: 1000,
        height: 1000,
        format: 'jpeg',
        size: 500000,
        contentType: 'image/jpeg'
      };

      const estimate = estimateProcessingTime(metadata);

      // 1,000,000 pixels / 10,000 = 100ms base
      // 4 variants * 100 = 400ms + 500ms overhead = 900ms
      expect(estimate).toBeGreaterThan(500);
      expect(estimate).toBeLessThan(2000);
    });

    it('should scale with image size', () => {
      const small: ImageMetadata = {
        width: 100,
        height: 100,
        format: 'jpeg',
        size: 10000,
        contentType: 'image/jpeg'
      };

      const large: ImageMetadata = {
        width: 4000,
        height: 3000,
        format: 'jpeg',
        size: 5000000,
        contentType: 'image/jpeg'
      };

      const smallEstimate = estimateProcessingTime(small);
      const largeEstimate = estimateProcessingTime(large);

      expect(largeEstimate).toBeGreaterThan(smallEstimate);
    });
  });
});

describe('CDN Storage Path Structure', () => {
  it('should follow the documented structure', () => {
    // As per task spec:
    // cdn/uploads/products/{brand_id}/{product_id}/original.jpg
    // We use products/{brand_id}/{product_id}/... (without cdn/uploads prefix)

    const brandId = 'acme-corp';
    const productId = 'widget-001';

    const originalPath = generateStoragePath(brandId, productId, 'original');
    const thumbPath = generateStoragePath(brandId, productId, 'thumb');
    const previewPath = generateStoragePath(brandId, productId, 'preview');
    const largePath = generateStoragePath(brandId, productId, 'large');

    expect(originalPath).toMatch(/^products\/acme-corp\/widget-001\/original\.jpg$/);
    expect(thumbPath).toMatch(/^products\/acme-corp\/widget-001\/thumb\.jpg$/);
    expect(previewPath).toMatch(/^products\/acme-corp\/widget-001\/preview\.jpg$/);
    expect(largePath).toMatch(/^products\/acme-corp\/widget-001\/large\.jpg$/);
  });
});

describe('Image Service Integration', () => {
  describe('ImageService.generateFallbackUrls', () => {
    // Import dynamically to avoid issues with mocks
    let ImageService: typeof import('./imageService').ImageService;

    beforeAll(async () => {
      const module = await import('./imageService');
      ImageService = module.ImageService;
    });

    it('should return fallbacks for null imageUrls', () => {
      const fallback = 'https://placeholder.com/image.jpg';
      const result = ImageService.generateFallbackUrls(null, fallback);

      expect(result.original).toBe(fallback);
      expect(result.thumb).toBe(fallback);
      expect(result.preview).toBe(fallback);
      expect(result.large).toBe(fallback);
    });

    it('should return fallbacks for partial imageUrls', () => {
      const fallback = 'https://placeholder.com/image.jpg';
      const partial = {
        original: 'https://cdn.example.com/original.jpg',
        thumb: 'https://cdn.example.com/thumb.jpg'
      };

      const result = ImageService.generateFallbackUrls(partial, fallback);

      expect(result.original).toBe('https://cdn.example.com/original.jpg');
      expect(result.thumb).toBe('https://cdn.example.com/thumb.jpg');
      expect(result.preview).toBe(fallback);
      expect(result.large).toBe(fallback);
    });

    it('should preserve complete imageUrls', () => {
      const fallback = 'https://placeholder.com/image.jpg';
      const complete = {
        original: 'https://cdn.example.com/original.jpg',
        thumb: 'https://cdn.example.com/thumb.jpg',
        preview: 'https://cdn.example.com/preview.jpg',
        large: 'https://cdn.example.com/large.jpg'
      };

      const result = ImageService.generateFallbackUrls(complete, fallback);

      expect(result).toEqual(complete);
    });
  });
});
