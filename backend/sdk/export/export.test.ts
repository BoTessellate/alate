/**
 * Export Module Tests
 * Tests for metadata building and export functionality
 */

import {
  buildMetadata,
  normalizeProducts,
  formatPrice,
  normalizeTheme,
  normalizeColor,
  serializeMetadata,
  parseMetadata,
  validateMetadata,
  extractSummary
} from './metadataBuilder';
import {
  generateExportFilename,
  getMimeType
} from './exportMoodboard';
import { MoodboardExportInput, MoodboardMetadata, ExportProductInfo } from './types';

describe('Metadata Builder', () => {
  const sampleInput: MoodboardExportInput = {
    id: 'test-123',
    name: 'Summer Collection',
    imageData: Buffer.from('fake-image'),
    products: [
      {
        brand: 'Jaypore',
        name: 'Blue linen kurta',
        url: 'https://jaypore.com/product/123',
        price: '₹2499',
        tags: ['organic', 'formal', 'womenswear']
      },
      {
        brand: 'Fabindia',
        name: 'Cotton shirt',
        url: 'https://fabindia.com/product/456',
        tags: ['casual', 'menswear']
      }
    ],
    theme: {
      primary: '#4c7031',
      secondary: '#f6e9cf',
      accent: '#222222'
    },
    layout: 'Layered Spread'
  };

  describe('buildMetadata', () => {
    it('should build complete metadata from input', () => {
      const metadata = buildMetadata(sampleInput);

      expect(metadata.id).toBe('test-123');
      expect(metadata.name).toBe('Summer Collection');
      expect(metadata.products).toHaveLength(2);
      expect(metadata.theme.primary).toBe('#4c7031');
      expect(metadata.layout).toBe('Layered Spread');
      expect(metadata.generated_at).toBeDefined();
      expect(metadata.version).toBe('1.0.0');
    });

    it('should include generated_at timestamp', () => {
      const before = new Date().toISOString();
      const metadata = buildMetadata(sampleInput);
      const after = new Date().toISOString();

      expect(metadata.generated_at >= before).toBe(true);
      expect(metadata.generated_at <= after).toBe(true);
    });
  });

  describe('normalizeProducts', () => {
    it('should normalize product array', () => {
      const products: ExportProductInfo[] = [
        { brand: 'Test', name: 'Product', url: 'https://test.com', tags: ['tag1'] }
      ];

      const normalized = normalizeProducts(products);

      expect(normalized[0].brand).toBe('Test');
      expect(normalized[0].name).toBe('Product');
      expect(normalized[0].tags).toEqual(['tag1']);
    });

    it('should handle missing fields with defaults', () => {
      const products = [
        { brand: '', name: '', url: '', tags: [] }
      ] as ExportProductInfo[];

      const normalized = normalizeProducts(products);

      expect(normalized[0].brand).toBe('Unknown');
      expect(normalized[0].name).toBe('Untitled Product');
    });

    it('should handle non-array tags', () => {
      const products = [
        { brand: 'Test', name: 'Product', url: '', tags: null as any }
      ];

      const normalized = normalizeProducts(products);

      expect(normalized[0].tags).toEqual([]);
    });
  });

  describe('formatPrice', () => {
    it('should format number as currency', () => {
      expect(formatPrice(2499)).toBe('$2499.00');
      expect(formatPrice(99.99)).toBe('$99.99');
    });

    it('should preserve string prices', () => {
      expect(formatPrice('₹2499')).toBe('₹2499');
      expect(formatPrice('$50.00')).toBe('$50.00');
    });

    it('should return undefined for missing price', () => {
      expect(formatPrice(undefined)).toBeUndefined();
      expect(formatPrice(null as any)).toBeUndefined();
    });
  });

  describe('normalizeTheme', () => {
    it('should normalize complete theme', () => {
      const theme = normalizeTheme({
        primary: '#4c7031',
        secondary: '#f6e9cf',
        accent: '#222222'
      });

      expect(theme.primary).toBe('#4c7031');
      expect(theme.secondary).toBe('#f6e9cf');
      expect(theme.accent).toBe('#222222');
    });

    it('should provide defaults for missing colors', () => {
      const theme = normalizeTheme({});

      expect(theme.primary).toBe('#000000');
      expect(theme.secondary).toBe('#ffffff');
    });
  });

  describe('normalizeColor', () => {
    it('should preserve valid hex colors', () => {
      expect(normalizeColor('#4c7031')).toBe('#4c7031');
      expect(normalizeColor('#FFFFFF')).toBe('#ffffff');
    });

    it('should expand short hex', () => {
      expect(normalizeColor('#fff')).toBe('#ffffff');
      expect(normalizeColor('#F00')).toBe('#ff0000');
    });

    it('should convert RGB to hex', () => {
      expect(normalizeColor('rgb(255, 0, 0)')).toBe('#ff0000');
      expect(normalizeColor('rgb(0, 128, 255)')).toBe('#0080ff');
    });

    it('should return undefined for missing input', () => {
      expect(normalizeColor(undefined)).toBeUndefined();
      expect(normalizeColor('')).toBeUndefined();
    });
  });

  describe('serializeMetadata / parseMetadata', () => {
    it('should serialize and parse metadata', () => {
      const metadata = buildMetadata(sampleInput);
      const json = serializeMetadata(metadata);
      const parsed = parseMetadata(json);

      expect(parsed.id).toBe(metadata.id);
      expect(parsed.products).toHaveLength(metadata.products.length);
      expect(parsed.theme.primary).toBe(metadata.theme.primary);
    });

    it('should support compact serialization', () => {
      const metadata = buildMetadata(sampleInput);
      const pretty = serializeMetadata(metadata, true);
      const compact = serializeMetadata(metadata, false);

      expect(pretty.length).toBeGreaterThan(compact.length);
      expect(pretty).toContain('\n');
      expect(compact).not.toContain('\n');
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseMetadata('invalid')).toThrow();
    });

    it('should throw on missing required fields', () => {
      expect(() => parseMetadata('{}')).toThrow('Invalid metadata');
    });
  });

  describe('validateMetadata', () => {
    it('should validate correct metadata', () => {
      const metadata = buildMetadata(sampleInput);
      const result = validateMetadata(metadata);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report missing id', () => {
      const metadata = buildMetadata(sampleInput);
      (metadata as any).id = '';

      const result = validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing id');
    });

    it('should report invalid products', () => {
      const metadata = buildMetadata(sampleInput);
      (metadata as any).products = 'not an array';

      const result = validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Products'))).toBe(true);
    });

    it('should report missing theme colors', () => {
      const metadata = buildMetadata(sampleInput);
      (metadata as any).theme = {};

      const result = validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Theme'))).toBe(true);
    });
  });

  describe('extractSummary', () => {
    it('should extract product count', () => {
      const metadata = buildMetadata(sampleInput);
      const summary = extractSummary(metadata);

      expect(summary.productCount).toBe(2);
    });

    it('should extract unique brands', () => {
      const metadata = buildMetadata(sampleInput);
      const summary = extractSummary(metadata);

      expect(summary.brands).toContain('Jaypore');
      expect(summary.brands).toContain('Fabindia');
      expect(summary.brands).toHaveLength(2);
    });

    it('should extract all unique tags', () => {
      const metadata = buildMetadata(sampleInput);
      const summary = extractSummary(metadata);

      expect(summary.totalTags).toContain('organic');
      expect(summary.totalTags).toContain('casual');
      expect(summary.totalTags).toContain('menswear');
    });

    it('should extract color palette', () => {
      const metadata = buildMetadata(sampleInput);
      const summary = extractSummary(metadata);

      expect(summary.colorPalette).toContain('#4c7031');
      expect(summary.colorPalette).toContain('#f6e9cf');
      expect(summary.colorPalette).toContain('#222222');
    });
  });
});

describe('Export Utilities', () => {
  describe('generateExportFilename', () => {
    it('should generate filename with moodboard ID', () => {
      const filename = generateExportFilename('abc123', 'png');

      expect(filename).toMatch(/^moodboard_abc123_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/);
    });

    it('should support different formats', () => {
      expect(generateExportFilename('id', 'png')).toContain('.png');
      expect(generateExportFilename('id', 'jpg')).toContain('.jpg');
      expect(generateExportFilename('id', 'zip')).toContain('.zip');
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types', () => {
      expect(getMimeType('png')).toBe('image/png');
      expect(getMimeType('jpg')).toBe('image/jpeg');
      expect(getMimeType('zip')).toBe('application/zip');
    });
  });
});

describe('Export Integration', () => {
  it('should produce valid JSON matching spec format', () => {
    // Test against the exact format from task spec
    const metadata = buildMetadata({
      id: 'abc123',
      imageData: Buffer.from(''),
      products: [
        {
          brand: 'Jaypore',
          name: 'Blue linen kurta',
          url: 'https://jaypore.com/...',
          price: '₹2499',
          tags: ['organic', 'formal', 'womenswear']
        }
      ],
      theme: {
        primary: '#4c7031',
        secondary: '#f6e9cf',
        accent: '#222222'
      },
      layout: 'Layered Spread'
    });

    const json = serializeMetadata(metadata);
    const parsed = JSON.parse(json);

    // Verify structure matches spec
    expect(parsed.products[0]).toHaveProperty('brand', 'Jaypore');
    expect(parsed.products[0]).toHaveProperty('name', 'Blue linen kurta');
    expect(parsed.products[0]).toHaveProperty('tags');
    expect(parsed.theme).toHaveProperty('primary', '#4c7031');
    expect(parsed.theme).toHaveProperty('secondary', '#f6e9cf');
    expect(parsed.theme).toHaveProperty('accent', '#222222');
    expect(parsed).toHaveProperty('layout', 'Layered Spread');
    expect(parsed).toHaveProperty('generated_at');
  });
});
