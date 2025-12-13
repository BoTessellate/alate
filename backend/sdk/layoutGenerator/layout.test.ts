/**
 * Layout Generator Test Suite
 * Comprehensive tests for moodboard layout generation
 */

import { createLayoutGenerator } from './generateLayout';
import { LayoutInput, ProductInput } from './types';
import { getArchetype, findArchetypesForProductCount } from './layoutArchetypes';

describe('Layout Archetypes', () => {
  test('All archetypes are defined', () => {
    const archetypes = [
      'ZigZagStaggered',
      'LayeredCenterpiece',
      'MinimalSplit',
      'GridWithOverlap',
      'DiagonalCascade',
      'SymmetricBalance',
      'AsymmetricFlow',
      'CollageStyle'
    ];

    archetypes.forEach(name => {
      const archetype = getArchetype(name as any);
      expect(archetype).toBeDefined();
      expect(archetype.name).toBe(name);
    });
  });

  test('Find archetypes for product count works', () => {
    const suitable3 = findArchetypesForProductCount(3);
    expect(suitable3.length).toBeGreaterThan(0);
    suitable3.forEach(archetype => {
      expect(3).toBeGreaterThanOrEqual(archetype.minItems);
      expect(3).toBeLessThanOrEqual(archetype.maxItems);
    });

    const suitable8 = findArchetypesForProductCount(8);
    expect(suitable8.length).toBeGreaterThan(0);
  });
});

describe('Layout Generation - Basic Functionality', () => {
  const layoutGenerator = createLayoutGenerator();

  const createMockProducts = (count: number): ProductInput[] => {
    return Array.from({ length: count }, (_, i) => ({
      image_url: `https://example.com/product-${i + 1}.jpg`,
      brand: `Brand ${i + 1}`,
      tags: ['test', 'mock'],
      product_name: `Product ${i + 1}`,
      price: 100 * (i + 1)
    }));
  };

  test('Generate ZigZag layout with 3 products', async () => {
    const input: LayoutInput = {
      products: createMockProducts(3),
      layout_type: 'ZigZagStaggered'
    };

    const layout = await layoutGenerator.generateLayout(input);

    expect(layout.layout_type).toBe('ZigZagStaggered');
    expect(layout.elements.length).toBeGreaterThan(0);
    expect(layout.metadata?.product_count).toBe(3);
    expect(layout.canvas_size).toBeDefined();
  });

  test('Generate Layered Centerpiece with 5 products', async () => {
    const input: LayoutInput = {
      products: createMockProducts(5),
      layout_type: 'LayeredCenterpiece'
    };

    const layout = await layoutGenerator.generateLayout(input);

    expect(layout.layout_type).toBe('LayeredCenterpiece');
    expect(layout.elements.length).toBeGreaterThan(0);
    expect(layout.metadata?.product_count).toBe(5);

    // Should have images and labels
    const images = layout.elements.filter(e => e.type === 'image');
    const labels = layout.elements.filter(e => e.type === 'label' || e.type === 'text');

    expect(images.length).toBe(5);
    expect(labels.length).toBeGreaterThan(0);
  });

  test('Generate Grid layout with 8 products', async () => {
    const input: LayoutInput = {
      products: createMockProducts(8),
      layout_type: 'GridWithOverlap'
    };

    const layout = await layoutGenerator.generateLayout(input);

    expect(layout.layout_type).toBe('GridWithOverlap');
    expect(layout.elements.length).toBeGreaterThan(0);
    expect(layout.metadata?.product_count).toBe(8);
  });

  test('Labels can be disabled', async () => {
    const input: LayoutInput = {
      products: createMockProducts(3),
      layout_type: 'MinimalSplit',
      show_labels: false
    };

    const layout = await layoutGenerator.generateLayout(input);

    const labels = layout.elements.filter(
      e => e.type === 'label' || e.type === 'text' || e.type === 'caption'
    );

    expect(labels.length).toBe(0);
  });

  test('Custom canvas size is respected', async () => {
    const customSize = { width: 1500, height: 2000 };
    const input: LayoutInput = {
      products: createMockProducts(3),
      layout_type: 'ZigZagStaggered',
      canvas_size: customSize
    };

    const layout = await layoutGenerator.generateLayout(input);

    expect(layout.canvas_size).toEqual(customSize);
  });
});

describe('Layout Generation - All Archetypes', () => {
  const layoutGenerator = createLayoutGenerator();

  const createMockProducts = (count: number): ProductInput[] => {
    return Array.from({ length: count }, (_, i) => ({
      image_url: `https://example.com/product-${i + 1}.jpg`,
      brand: `Brand ${i + 1}`,
      tags: ['test']
    }));
  };

  test('MinimalSplit with 2 products', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(2),
      layout_type: 'MinimalSplit'
    });

    expect(layout.elements.length).toBeGreaterThan(0);
    const images = layout.elements.filter(e => e.type === 'image');
    expect(images.length).toBe(2);
  });

  test('DiagonalCascade with 4 products', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(4),
      layout_type: 'DiagonalCascade'
    });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  test('SymmetricBalance with 6 products', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(6),
      layout_type: 'SymmetricBalance'
    });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  test('AsymmetricFlow with 5 products', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(5),
      layout_type: 'AsymmetricFlow'
    });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  test('CollageStyle with 7 products', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(7),
      layout_type: 'CollageStyle'
    });

    expect(layout.elements.length).toBeGreaterThan(0);
  });
});

describe('Layout Validation', () => {
  const layoutGenerator = createLayoutGenerator();

  const createMockProducts = (count: number): ProductInput[] => {
    return Array.from({ length: count }, (_, i) => ({
      image_url: `https://example.com/product-${i + 1}.jpg`,
      brand: `Brand ${i + 1}`
    }));
  };

  test('All elements have positions', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(5),
      layout_type: 'LayeredCenterpiece'
    });

    layout.elements.forEach(element => {
      expect(element.position).toBeDefined();
      expect(element.position.x).toBeGreaterThanOrEqual(0);
      expect(element.position.y).toBeGreaterThanOrEqual(0);
    });
  });

  test('Images have sizes', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(3),
      layout_type: 'ZigZagStaggered'
    });

    const images = layout.elements.filter(e => e.type === 'image');

    images.forEach(image => {
      expect(image.size).toBeDefined();
      expect(image.size!.width).toBeGreaterThan(0);
      expect(image.size!.height).toBeGreaterThan(0);
    });
  });

  test('Elements are within canvas bounds', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(5),
      layout_type: 'GridWithOverlap'
    });

    const images = layout.elements.filter(e => e.type === 'image');

    images.forEach(image => {
      if (image.size) {
        const rightEdge = image.position.x + image.size.width;
        const bottomEdge = image.position.y + image.size.height;

        // Allow some tolerance for overflow
        expect(rightEdge).toBeLessThanOrEqual(layout.canvas_size.width + 50);
        expect(bottomEdge).toBeLessThanOrEqual(layout.canvas_size.height + 50);
      }
    });
  });

  test('Z-index is assigned', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(4),
      layout_type: 'LayeredCenterpiece'
    });

    const hasZIndex = layout.elements.some(e => e.zIndex !== undefined);
    expect(hasZIndex).toBe(true);
  });

  test('Error on too few products', async () => {
    await expect(
      layoutGenerator.generateLayout({
        products: createMockProducts(1),
        layout_type: 'LayeredCenterpiece' // Requires min 3
      })
    ).rejects.toThrow();
  });

  test('Error on too many products', async () => {
    await expect(
      layoutGenerator.generateLayout({
        products: createMockProducts(20),
        layout_type: 'MinimalSplit' // Supports max 4
      })
    ).rejects.toThrow();
  });
});

describe('Layout Elements', () => {
  const layoutGenerator = createLayoutGenerator();

  const createMockProducts = (count: number): ProductInput[] => {
    return Array.from({ length: count }, (_, i) => ({
      image_url: `https://example.com/product-${i + 1}.jpg`,
      brand: `Brand ${i + 1}`,
      product_name: `Product ${i + 1}`,
      price: 100 * (i + 1)
    }));
  };

  test('Labels contain brand names', async () => {
    const products = createMockProducts(3);
    const layout = await layoutGenerator.generateLayout({
      products,
      layout_type: 'ZigZagStaggered',
      show_labels: true
    });

    const labels = layout.elements.filter(
      e => e.type === 'label' || e.type === 'text'
    );

    labels.forEach(label => {
      expect(label.text).toBeDefined();
      const matchesBrand = products.some(p => p.brand === label.text);
      expect(matchesBrand).toBe(true);
    });
  });

  test('Image elements have src URLs', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(3),
      layout_type: 'MinimalSplit'
    });

    const images = layout.elements.filter(e => e.type === 'image');

    images.forEach(image => {
      expect(image.src).toBeDefined();
      expect(image.src).toContain('http');
    });
  });

  test('Rotation is applied when allowed', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(5),
      layout_type: 'CollageStyle' // Uses rotation
    });

    const rotated = layout.elements.filter(e => e.rotation !== undefined && e.rotation !== 0);
    expect(rotated.length).toBeGreaterThan(0);
  });
});

describe('Metadata', () => {
  const layoutGenerator = createLayoutGenerator();

  const createMockProducts = (count: number): ProductInput[] => {
    return Array.from({ length: count }, (_, i) => ({
      image_url: `https://example.com/product-${i + 1}.jpg`,
      brand: `Brand ${i + 1}`
    }));
  };

  test('Metadata includes generation timestamp', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(3),
      layout_type: 'ZigZagStaggered'
    });

    expect(layout.metadata?.generated_at).toBeDefined();
    const timestamp = new Date(layout.metadata!.generated_at);
    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('Metadata includes product count', async () => {
    const productCount = 5;
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(productCount),
      layout_type: 'GridWithOverlap'
    });

    expect(layout.metadata?.product_count).toBe(productCount);
  });

  test('Metadata includes archetype description', async () => {
    const layout = await layoutGenerator.generateLayout({
      products: createMockProducts(3),
      layout_type: 'LayeredCenterpiece'
    });

    expect(layout.metadata?.archetype_description).toBeDefined();
    expect(layout.metadata?.archetype_description.length).toBeGreaterThan(0);
  });
});
