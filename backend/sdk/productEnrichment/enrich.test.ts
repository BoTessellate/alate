/**
 * Product Enrichment Test Suite
 * Tests for enrichProduct and validateProduct modules
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ProductEnrichmentEngine, createEnrichmentEngine } from './enrichProduct';
import {
  validateRawProduct,
  validateEnrichedFields,
  sanitizeProductName,
  normalizeCategory
} from './validateProduct';
import { RawProductInput, EnrichedProductFields } from './types';

// Mock product data across different categories
const mockProducts: RawProductInput[] = [
  // Home Decor
  {
    product_name: 'Handwoven Ikat Cushion',
    brand: 'Amala Earth',
    category: 'home',
    price: 799,
    region: 'India',
    dimensions: '40x40cm'
  },
  // Fashion
  {
    product_name: 'Organic Cotton Kurta',
    brand: 'FabIndia',
    category: 'fashion',
    price: 1499,
    region: 'India'
  },
  // Kids
  {
    product_name: 'Wooden Alphabet Blocks',
    brand: 'Kinder Toys',
    category: 'kids',
    price: 599,
    region: 'Germany'
  },
  // Home - Minimal
  {
    product_name: 'Ceramic Matte Black Vase',
    brand: 'Studio Pottery',
    category: 'home',
    price: 1200,
    region: 'Japan',
    dimensions: '25cm height'
  },
  // Fashion - Luxury
  {
    product_name: 'Silk Embroidered Saree',
    brand: 'Sabyasachi',
    category: 'fashion',
    price: 25000,
    region: 'India'
  }
];

// ==================== VALIDATION TESTS ====================

describe('validateRawProduct', () => {
  it('should pass validation for valid product', () => {
    const result = validateRawProduct(mockProducts[0]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail if product_name is missing', () => {
    const invalid = { ...mockProducts[0], product_name: '' };
    const result = validateRawProduct(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('product_name is required and cannot be empty');
  });

  it('should fail if brand is missing', () => {
    const invalid = { ...mockProducts[0], brand: '' };
    const result = validateRawProduct(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('brand is required and cannot be empty');
  });

  it('should fail if category is missing', () => {
    const invalid = { ...mockProducts[0], category: '' };
    const result = validateRawProduct(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('category is required and cannot be empty');
  });

  it('should fail if price is negative', () => {
    const invalid = { ...mockProducts[0], price: -100 };
    const result = validateRawProduct(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('price must be a positive number');
  });

  it('should pass if optional fields are missing', () => {
    const minimal: RawProductInput = {
      product_name: 'Test Product',
      brand: 'Test Brand',
      category: 'test'
    };
    const result = validateRawProduct(minimal);
    expect(result.isValid).toBe(true);
  });
});

describe('validateEnrichedFields', () => {
  const validEnriched: EnrichedProductFields = {
    color_palette: ['indigo', 'cream', 'brick red'],
    tags: ['handwoven', 'traditional', 'boho', 'textured'],
    texture: 'woven',
    material: 'cotton',
    tone: 'earthy'
  };

  it('should pass validation for valid enriched fields', () => {
    const result = validateEnrichedFields(validEnriched);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail if color_palette has less than 2 colors', () => {
    const invalid = { ...validEnriched, color_palette: ['red'] };
    const result = validateEnrichedFields(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('at least 2 colors'))).toBe(true);
  });

  it('should fail if color_palette has duplicate colors', () => {
    const invalid = { ...validEnriched, color_palette: ['red', 'red'] };
    const result = validateEnrichedFields(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('distinct colors'))).toBe(true);
  });

  it('should fail if tags has less than 3 items', () => {
    const invalid = { ...validEnriched, tags: ['modern', 'sleek'] };
    const result = validateEnrichedFields(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('at least 3'))).toBe(true);
  });

  it('should fail if texture is empty', () => {
    const invalid = { ...validEnriched, texture: '' };
    const result = validateEnrichedFields(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('texture'))).toBe(true);
  });

  it('should fail if material is empty', () => {
    const invalid = { ...validEnriched, material: '' };
    const result = validateEnrichedFields(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('material'))).toBe(true);
  });

  it('should fail if tone is empty', () => {
    const invalid = { ...validEnriched, tone: '' };
    const result = validateEnrichedFields(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('tone'))).toBe(true);
  });

  it('should flag vague tone values', () => {
    const invalid = { ...validEnriched, tone: 'nice' };
    const result = validateEnrichedFields(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('too vague'))).toBe(true);
  });
});

describe('sanitizeProductName', () => {
  it('should remove extra whitespace', () => {
    expect(sanitizeProductName('  Product   Name  ')).toBe('Product Name');
  });

  it('should normalize multiple spaces', () => {
    expect(sanitizeProductName('Product    Name')).toBe('Product Name');
  });
});

describe('normalizeCategory', () => {
  it('should convert to lowercase', () => {
    expect(normalizeCategory('HOME')).toBe('home');
    expect(normalizeCategory('Fashion')).toBe('fashion');
  });

  it('should trim whitespace', () => {
    expect(normalizeCategory('  home  ')).toBe('home');
  });
});

// ==================== ENRICHMENT ENGINE TESTS ====================

describe('ProductEnrichmentEngine', () => {
  let engine: ProductEnrichmentEngine;

  beforeAll(() => {
    // Initialize with environment variables or test config
    const config = {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
      supabaseUrl: process.env.SUPABASE_URL || 'https://test.supabase.co',
      supabaseKey: process.env.SUPABASE_KEY || 'test-key'
    };

    engine = createEnrichmentEngine(config);
  });

  it('should create enrichment engine instance', () => {
    expect(engine).toBeDefined();
    expect(engine).toBeInstanceOf(ProductEnrichmentEngine);
  });

  // Note: The following tests require valid API keys to run
  // They are skipped by default to avoid API costs during development

  describe.skip('enrichProduct (requires API key)', () => {
    it('should enrich home decor product', async () => {
      const enriched = await engine.enrichProduct(mockProducts[0]);

      expect(enriched).toBeDefined();
      expect(enriched.color_palette).toBeDefined();
      expect(enriched.color_palette.length).toBeGreaterThanOrEqual(2);
      expect(enriched.tags).toBeDefined();
      expect(enriched.tags.length).toBeGreaterThanOrEqual(3);
      expect(enriched.texture).toBeDefined();
      expect(enriched.material).toBeDefined();
      expect(enriched.tone).toBeDefined();
      expect(enriched.enriched_at).toBeDefined();
    });

    it('should enrich fashion product', async () => {
      const enriched = await engine.enrichProduct(mockProducts[1]);

      expect(enriched).toBeDefined();
      expect(enriched.tags).toContain('organic');
      expect(enriched.material).toContain('cotton');
    });

    it('should enrich kids product', async () => {
      const enriched = await engine.enrichProduct(mockProducts[2]);

      expect(enriched).toBeDefined();
      expect(enriched.material).toContain('wood');
      expect(enriched.tags.length).toBeGreaterThanOrEqual(3);
    });

    it('should enrich minimal home product', async () => {
      const enriched = await engine.enrichProduct(mockProducts[3]);

      expect(enriched).toBeDefined();
      expect(enriched.tone).toMatch(/minimalist|modern|clean/i);
      expect(enriched.color_palette).toContain('black');
    });

    it('should enrich luxury fashion product', async () => {
      const enriched = await engine.enrichProduct(mockProducts[4]);

      expect(enriched).toBeDefined();
      expect(enriched.tone).toMatch(/luxury|elegant|premium/i);
      expect(enriched.material).toContain('silk');
    });
  });

  describe.skip('enrichBatch (requires API key)', () => {
    it('should enrich multiple products', async () => {
      const enrichedBatch = await engine.enrichBatch(mockProducts);

      expect(enrichedBatch).toBeDefined();
      expect(enrichedBatch.length).toBe(mockProducts.length);

      enrichedBatch.forEach((product) => {
        expect(product.color_palette).toBeDefined();
        expect(product.tags.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe.skip('saveToDatabase (requires Supabase)', () => {
    it('should save enriched product to database', async () => {
      const enriched = await engine.enrichProduct(mockProducts[0]);
      const saved = await engine.saveToDatabase(enriched);

      expect(saved).toBeDefined();
      expect(saved.id).toBeDefined();
      expect(saved.created_at).toBeDefined();
    });
  });

  describe.skip('enrichAndSave (requires both API keys)', () => {
    it('should enrich and save product in one call', async () => {
      const saved = await engine.enrichAndSave(mockProducts[0]);

      expect(saved).toBeDefined();
      expect(saved.id).toBeDefined();
      expect(saved.enriched_at).toBeDefined();
      expect(saved.tags.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// ==================== EXPORT MOCK DATA FOR MANUAL TESTING ====================

export { mockProducts };
