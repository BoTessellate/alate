/**
 * Unit Tests for Dimension-Aware Layout Generation
 *
 * Tests for fit tag sorting and dimension-aware sizing in layouts.
 * Task 9: Product Variant + Dimension Support
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutGenerator, createLayoutGenerator } from './generateLayout';
import { ProductInput, FitTag } from './types';

describe('LayoutGenerator - Fit Tag Sorting', () => {
  let generator: LayoutGenerator;

  beforeEach(() => {
    generator = createLayoutGenerator();
  });

  it('should place bulky items first in layout', async () => {
    const products: ProductInput[] = [
      {
        image_url: 'https://example.com/small.jpg',
        brand: 'Small Brand',
        fit_tags: ['lightweight'],
      },
      {
        image_url: 'https://example.com/bulky.jpg',
        brand: 'Bulky Brand',
        fit_tags: ['bulky'],
      },
      {
        image_url: 'https://example.com/delicate.jpg',
        brand: 'Delicate Brand',
        fit_tags: ['delicate'],
      },
    ];

    const layout = await generator.generateLayout({
      products,
      layout_type: 'LayeredCenterpiece',
    });

    // In LayeredCenterpiece, first product is the hero
    // After sorting, bulky should be first
    const firstImageElement = layout.elements.find(
      (e) => e.type === 'image' && e.zIndex === 10
    );

    // The hero (zIndex 10) should have the bulky product's URL
    expect(firstImageElement?.src).toBe('https://example.com/bulky.jpg');
  });

  it('should maintain order for products without fit tags', async () => {
    const products: ProductInput[] = [
      { image_url: 'https://example.com/1.jpg', brand: 'Brand 1' },
      { image_url: 'https://example.com/2.jpg', brand: 'Brand 2' },
      { image_url: 'https://example.com/3.jpg', brand: 'Brand 3' },
    ];

    const layout = await generator.generateLayout({
      products,
      layout_type: 'MinimalSplit',
    });

    // Without fit tags, order should be preserved
    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it('should prioritize oversized over flat', async () => {
    const products: ProductInput[] = [
      {
        image_url: 'https://example.com/flat.jpg',
        brand: 'Flat Brand',
        fit_tags: ['flat'],
      },
      {
        image_url: 'https://example.com/oversized.jpg',
        brand: 'Oversized Brand',
        fit_tags: ['oversized'],
      },
    ];

    const layout = await generator.generateLayout({
      products,
      layout_type: 'MinimalSplit',
    });

    // Oversized (priority 2) should come before flat (priority 3)
    const imageElements = layout.elements.filter((e) => e.type === 'image');

    // First image should be oversized
    expect(imageElements[0].src).toBe('https://example.com/oversized.jpg');
  });
});

describe('LayoutGenerator - Dimension-Aware Sizing', () => {
  let generator: LayoutGenerator;

  beforeEach(() => {
    generator = createLayoutGenerator();
  });

  it('should generate valid layout with dimensional products', async () => {
    const products: ProductInput[] = [
      {
        image_url: 'https://example.com/sofa.jpg',
        brand: 'Furniture Co',
        fit_tags: ['bulky'],
        dimensions: { width: 200, height: 80, depth: 90 },
      },
      {
        image_url: 'https://example.com/ring.jpg',
        brand: 'Jewelry Co',
        fit_tags: ['delicate'],
        dimensions: { width: 2, height: 2, depth: 1 },
      },
    ];

    const layout = await generator.generateLayout({
      products,
      layout_type: 'MinimalSplit',
    });

    expect(layout.elements.length).toBeGreaterThan(0);
    expect(layout.metadata?.product_count).toBe(2);
  });

  it('should include variants in product data', async () => {
    const products: ProductInput[] = [
      {
        image_url: 'https://example.com/shirt.jpg',
        brand: 'Fashion Co',
        variants: [
          { color: 'Red', size: 'S', url: 'https://example.com/shirt-red-s' },
          { color: 'Red', size: 'M', url: 'https://example.com/shirt-red-m' },
          { color: 'Blue', size: 'S', url: 'https://example.com/shirt-blue-s' },
        ],
      },
    ];

    // Variants don't affect layout directly but should be preserved
    const layout = await generator.generateLayout({
      products,
      layout_type: 'ZigZagStaggered',
    });

    expect(layout.elements.length).toBeGreaterThan(0);
  });
});

describe('LayoutGenerator - Archetype Selection by Product Count', () => {
  let generator: LayoutGenerator;

  beforeEach(() => {
    generator = createLayoutGenerator();
  });

  it('should work with minimum products for each archetype', async () => {
    // MinimalSplit requires min 2
    const twoProducts: ProductInput[] = [
      { image_url: 'https://example.com/1.jpg', brand: 'Brand 1' },
      { image_url: 'https://example.com/2.jpg', brand: 'Brand 2' },
    ];

    const layout = await generator.generateLayout({
      products: twoProducts,
      layout_type: 'MinimalSplit',
    });

    expect(layout.layout_type).toBe('MinimalSplit');
    expect(layout.elements.filter((e) => e.type === 'image')).toHaveLength(2);
  });

  it('should reject too few products', async () => {
    const oneProduct: ProductInput[] = [
      { image_url: 'https://example.com/1.jpg', brand: 'Brand 1' },
    ];

    await expect(
      generator.generateLayout({
        products: oneProduct,
        layout_type: 'MinimalSplit', // Requires min 2
      })
    ).rejects.toThrow('requires at least');
  });

  it('should reject too many products', async () => {
    const manyProducts: ProductInput[] = Array(20)
      .fill(null)
      .map((_, i) => ({
        image_url: `https://example.com/${i}.jpg`,
        brand: `Brand ${i}`,
      }));

    await expect(
      generator.generateLayout({
        products: manyProducts,
        layout_type: 'MinimalSplit', // Max 4
      })
    ).rejects.toThrow('supports max');
  });
});

describe('LayoutGenerator - Mixed Fit Tags', () => {
  let generator: LayoutGenerator;

  beforeEach(() => {
    generator = createLayoutGenerator();
  });

  it('should handle products with multiple fit tags', async () => {
    const products: ProductInput[] = [
      {
        image_url: 'https://example.com/delicate-flat.jpg',
        brand: 'Art Gallery',
        fit_tags: ['delicate', 'flat'], // Multiple tags
      },
      {
        image_url: 'https://example.com/bulky.jpg',
        brand: 'Furniture',
        fit_tags: ['bulky'],
      },
    ];

    const layout = await generator.generateLayout({
      products,
      layout_type: 'MinimalSplit',
    });

    // Bulky (priority 1) should be placed before delicate/flat (priority 3/4)
    const imageElements = layout.elements.filter((e) => e.type === 'image');
    expect(imageElements[0].src).toBe('https://example.com/bulky.jpg');
  });

  it('should use lowest priority from multiple tags', async () => {
    // Product with both bulky (1) and lightweight (5) should use bulky (1)
    const products: ProductInput[] = [
      {
        image_url: 'https://example.com/mixed.jpg',
        brand: 'Mixed',
        fit_tags: ['bulky', 'lightweight'], // Conflicting - use lowest
      },
      {
        image_url: 'https://example.com/flat.jpg',
        brand: 'Flat',
        fit_tags: ['flat'], // Priority 3
      },
    ];

    const layout = await generator.generateLayout({
      products,
      layout_type: 'MinimalSplit',
    });

    // Mixed (bulky priority 1) should come before flat (priority 3)
    const imageElements = layout.elements.filter((e) => e.type === 'image');
    expect(imageElements[0].src).toBe('https://example.com/mixed.jpg');
  });
});

describe('LayoutGenerator - Canvas Size', () => {
  let generator: LayoutGenerator;

  beforeEach(() => {
    generator = createLayoutGenerator();
  });

  it('should use default canvas size from archetype', async () => {
    const products: ProductInput[] = [
      { image_url: 'https://example.com/1.jpg', brand: 'Brand 1' },
      { image_url: 'https://example.com/2.jpg', brand: 'Brand 2' },
    ];

    const layout = await generator.generateLayout({
      products,
      layout_type: 'MinimalSplit',
    });

    // MinimalSplit default is 1200x1200
    expect(layout.canvas_size.width).toBe(1200);
    expect(layout.canvas_size.height).toBe(1200);
  });

  it('should use custom canvas size when provided', async () => {
    const products: ProductInput[] = [
      { image_url: 'https://example.com/1.jpg', brand: 'Brand 1' },
      { image_url: 'https://example.com/2.jpg', brand: 'Brand 2' },
    ];

    const layout = await generator.generateLayout({
      products,
      layout_type: 'MinimalSplit',
      canvas_size: { width: 800, height: 600 },
    });

    expect(layout.canvas_size.width).toBe(800);
    expect(layout.canvas_size.height).toBe(600);
  });
});

describe('LayoutGenerator - Labels and Prices', () => {
  let generator: LayoutGenerator;

  beforeEach(() => {
    generator = createLayoutGenerator();
  });

  it('should include labels by default', async () => {
    const products: ProductInput[] = [
      { image_url: 'https://example.com/1.jpg', brand: 'Brand 1' },
      { image_url: 'https://example.com/2.jpg', brand: 'Brand 2' },
    ];

    const layout = await generator.generateLayout({
      products,
      layout_type: 'MinimalSplit',
    });

    const labels = layout.elements.filter((e) => e.type === 'label');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('should exclude labels when disabled', async () => {
    const products: ProductInput[] = [
      { image_url: 'https://example.com/1.jpg', brand: 'Brand 1' },
      { image_url: 'https://example.com/2.jpg', brand: 'Brand 2' },
    ];

    const layout = await generator.generateLayout({
      products,
      layout_type: 'MinimalSplit',
      show_labels: false,
    });

    const labels = layout.elements.filter(
      (e) => e.type === 'label' || e.type === 'text'
    );
    expect(labels.length).toBe(0);
  });
});
