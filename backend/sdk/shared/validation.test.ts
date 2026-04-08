/**
 * Tests for Zod Validation Schemas and Middleware
 */

import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  paginationSchema,
  uuidSchema,
  urlSchema,
  hexColorSchema,
  productEnrichmentSchema,
  searchQuerySchema,
  layoutArchetypeSchema,
  canvasSizeSchema,
  layoutRequestSchema,
  exportFormatSchema,
  socialPlatformSchema,
  moodboardSchema,
  pluginPlatformSchema,
  validateBody,
  validateQuery,
  validate,
  safeParse,
} from './validation';

describe('Common Schemas', () => {
  describe('paginationSchema', () => {
    it('should parse valid pagination', () => {
      const result = paginationSchema.parse({
        page: 2,
        limit: 50,
        sort_order: 'asc',
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.sort_order).toBe('asc');
    });

    it('should apply defaults', () => {
      const result = paginationSchema.parse({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sort_order).toBe('desc');
    });

    it('should coerce string numbers', () => {
      const result = paginationSchema.parse({
        page: '3',
        limit: '25',
      });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
    });

    it('should reject invalid values', () => {
      expect(() =>
        paginationSchema.parse({ page: 0 })
      ).toThrow();

      expect(() =>
        paginationSchema.parse({ limit: 101 })
      ).toThrow();
    });
  });

  describe('uuidSchema', () => {
    it('should accept valid UUIDs', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(uuidSchema.parse(uuid)).toBe(uuid);
    });

    it('should reject invalid UUIDs', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
      expect(() => uuidSchema.parse('')).toThrow();
    });
  });

  describe('urlSchema', () => {
    it('should accept valid URLs', () => {
      expect(urlSchema.parse('https://example.com')).toBe('https://example.com');
      expect(urlSchema.parse('http://localhost:3000/path')).toBe('http://localhost:3000/path');
    });

    it('should reject invalid URLs', () => {
      expect(() => urlSchema.parse('not-a-url')).toThrow();
      expect(() => urlSchema.parse('')).toThrow();
    });
  });

  describe('hexColorSchema', () => {
    it('should accept valid hex colors', () => {
      expect(hexColorSchema.parse('#FF5733')).toBe('#FF5733');
      expect(hexColorSchema.parse('#abc')).toBe('#abc');
      expect(hexColorSchema.parse('#AABBCC')).toBe('#AABBCC');
    });

    it('should reject invalid hex colors', () => {
      expect(() => hexColorSchema.parse('FF5733')).toThrow();
      expect(() => hexColorSchema.parse('#GGGGGG')).toThrow();
      expect(() => hexColorSchema.parse('#12345')).toThrow();
    });
  });
});

describe('Product Enrichment Schema', () => {
  it('should accept valid product with URL', () => {
    const result = productEnrichmentSchema.parse({
      url: 'https://example.com/product',
      title: 'Test Product',
    });

    expect(result.url).toBe('https://example.com/product');
  });

  it('should accept valid product with image URL', () => {
    const result = productEnrichmentSchema.parse({
      image_url: 'https://example.com/image.jpg',
    });

    expect(result.image_url).toBe('https://example.com/image.jpg');
  });

  it('should reject product without URL or image_url', () => {
    expect(() =>
      productEnrichmentSchema.parse({
        title: 'Test Product',
      })
    ).toThrow();
  });
});

describe('Search Query Schema', () => {
  it('should parse valid search query', () => {
    const result = searchQuerySchema.parse({
      query: 'blue ceramic vase',
      page: 1,
      limit: 10,
    });

    expect(result.query).toBe('blue ceramic vase');
  });

  it('should parse query with filters', () => {
    const result = searchQuerySchema.parse({
      query: 'vase',
      filters: {
        brand: 'Anthropologie',
        min_price: 50,
        colors: ['blue', 'white'],
      },
    });

    expect(result.filters?.brand).toBe('Anthropologie');
    expect(result.filters?.colors).toEqual(['blue', 'white']);
  });

  it('should reject empty query', () => {
    expect(() =>
      searchQuerySchema.parse({ query: '' })
    ).toThrow();
  });
});

describe('Layout Schemas', () => {
  describe('layoutArchetypeSchema', () => {
    it('should accept valid archetypes', () => {
      expect(layoutArchetypeSchema.parse('grid')).toBe('grid');
      expect(layoutArchetypeSchema.parse('zigzag')).toBe('zigzag');
      expect(layoutArchetypeSchema.parse('magazine')).toBe('magazine');
    });

    it('should reject invalid archetypes', () => {
      expect(() =>
        layoutArchetypeSchema.parse('invalid')
      ).toThrow();
    });
  });

  describe('canvasSizeSchema', () => {
    it('should accept valid canvas size', () => {
      const result = canvasSizeSchema.parse({
        width: 1080,
        height: 1920,
      });

      expect(result.width).toBe(1080);
      expect(result.height).toBe(1920);
    });

    it('should reject negative dimensions', () => {
      expect(() =>
        canvasSizeSchema.parse({ width: -100, height: 500 })
      ).toThrow();
    });

    it('should reject dimensions over max', () => {
      expect(() =>
        canvasSizeSchema.parse({ width: 20000, height: 500 })
      ).toThrow();
    });
  });

  describe('layoutRequestSchema', () => {
    it('should parse valid layout request', () => {
      const result = layoutRequestSchema.parse({
        archetype: 'grid',
        canvas_size: { width: 1080, height: 1080 },
        product_count: 9,
      });

      expect(result.archetype).toBe('grid');
      expect(result.spacing).toBe(16);
      expect(result.padding).toBe(24);
    });
  });
});

describe('Export Schemas', () => {
  describe('exportFormatSchema', () => {
    it('should accept valid formats', () => {
      expect(exportFormatSchema.parse('png')).toBe('png');
      expect(exportFormatSchema.parse('jpg')).toBe('jpg');
      expect(exportFormatSchema.parse('pdf')).toBe('pdf');
    });
  });

  describe('socialPlatformSchema', () => {
    it('should accept valid platforms', () => {
      expect(socialPlatformSchema.parse('instagram_post')).toBe('instagram_post');
      expect(socialPlatformSchema.parse('pinterest')).toBe('pinterest');
      expect(socialPlatformSchema.parse('tiktok')).toBe('tiktok');
    });
  });
});

describe('Moodboard Schema', () => {
  it('should parse valid moodboard', () => {
    const result = moodboardSchema.parse({
      name: 'My Mood Board',
      canvas_size: { width: 1080, height: 1080 },
      items: [],
    });

    expect(result.name).toBe('My Mood Board');
    expect(result.is_public).toBe(false);
  });

  it('should parse moodboard with items', () => {
    const result = moodboardSchema.parse({
      name: 'Test Board',
      canvas_size: { width: 800, height: 600 },
      items: [
        {
          type: 'image',
          position: { x: 0, y: 0, width: 200, height: 200 },
          image_url: 'https://example.com/img.jpg',
        },
      ],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('image');
  });
});

describe('Plugin Schemas', () => {
  describe('pluginPlatformSchema', () => {
    it('should accept valid platforms', () => {
      expect(pluginPlatformSchema.parse('shopify')).toBe('shopify');
      expect(pluginPlatformSchema.parse('woocommerce')).toBe('woocommerce');
      expect(pluginPlatformSchema.parse('wix')).toBe('wix');
    });
  });
});

describe('Validation Middleware', () => {
  const createMockRequest = (body: any = {}, query: any = {}): Partial<Request> => ({
    body,
    query,
    params: {},
  });

  const createMockResponse = (): Partial<Response> => {
    const res: Partial<Response> = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return res;
  };

  describe('validateBody', () => {
    it('should pass valid data', async () => {
      const middleware = validateBody(canvasSizeSchema);
      const req = createMockRequest({ width: 800, height: 600 });
      const res = createMockResponse();
      const next = vi.fn();

      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.width).toBe(800);
    });

    it('should reject invalid data', async () => {
      const middleware = validateBody(canvasSizeSchema);
      const req = createMockRequest({ width: -100 });
      const res = createMockResponse();
      const next = vi.fn();

      await middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    it('should pass valid query params', async () => {
      const middleware = validateQuery(paginationSchema);
      const req = createMockRequest({}, { page: '2', limit: '50' });
      const res = createMockResponse();
      const next = vi.fn();

      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(req.query.page).toBe(2);
    });
  });
});

describe('Validation Utilities', () => {
  describe('validate', () => {
    it('should return parsed data for valid input', async () => {
      const result = await validate(canvasSizeSchema, { width: 100, height: 100 });
      expect(result.width).toBe(100);
    });

    it('should throw ValidationError for invalid input', async () => {
      await expect(
        validate(canvasSizeSchema, { width: -1 })
      ).rejects.toThrow();
    });
  });

  describe('safeParse', () => {
    it('should return success for valid input', () => {
      const result = safeParse(uuidSchema, '123e4567-e89b-12d3-a456-426614174000');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('should return errors for invalid input', () => {
      const result = safeParse(uuidSchema, 'not-a-uuid');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
      }
    });
  });
});
