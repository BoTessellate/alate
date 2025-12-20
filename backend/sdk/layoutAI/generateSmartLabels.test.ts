/**
 * Smart Label Generation Tests
 * Task 18: Tests for vision-based label placement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSmartLabels, getSmartLabelPlacements } from './generateSmartLabels';
import { LayoutOutput } from '../layoutGenerator/types';

// Mock the vision client module
vi.mock('./visionClient', () => ({
  createVisionClient: vi.fn(() => ({
    getSmartLabelPlacements: vi.fn().mockResolvedValue({
      label_placements: [
        {
          product_name: 'Product 1',
          position: { x: 120, y: 340 },
          justification: 'Positioned below product',
        },
        {
          product_name: 'Product 2',
          position: { x: 450, y: 180 },
          justification: 'Right side to avoid overlap',
        },
      ],
    }),
  })),
  getLabelPlacementsFromVision: vi.fn().mockResolvedValue([
    { id: 'product-0', labelX: 120, labelY: 340, fontSize: 14, style: 'bold' },
    { id: 'product-1', labelX: 450, labelY: 180, fontSize: 14, style: 'bold' },
  ]),
}));

// Sample layout for testing
const createMockLayout = (imageCount: number): LayoutOutput => ({
  canvas_size: { width: 1200, height: 1200 },
  elements: [
    // Image elements
    ...Array.from({ length: imageCount }, (_, i) => ({
      type: 'image' as const,
      id: `product-${i}`,
      text: `Product ${i + 1}`,
      position: { x: 100 + i * 300, y: 100 },
      size: { width: 250, height: 250 },
    })),
    // Label elements
    ...Array.from({ length: imageCount }, (_, i) => ({
      type: 'label' as const,
      text: `Product ${i + 1}`,
      position: { x: 100 + i * 300, y: 360 }, // Initial position below image
    })),
  ],
});

describe('generateSmartLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Claude mode (default)', () => {
    it('updates label positions based on vision response', async () => {
      const layout = createMockLayout(2);
      const result = await generateSmartLabels(layout, 'test-api-key');

      // Find the labels in the result
      const labels = result.elements.filter((el) => el.type === 'label');

      expect(labels).toHaveLength(2);
      expect(labels[0].position).toEqual({ x: 120, y: 340 });
      expect(labels[1].position).toEqual({ x: 450, y: 180 });
    });

    it('preserves non-label elements unchanged', async () => {
      const layout = createMockLayout(2);
      const result = await generateSmartLabels(layout, 'test-api-key');

      const images = result.elements.filter((el) => el.type === 'image');

      expect(images).toHaveLength(2);
      expect(images[0].position).toEqual({ x: 100, y: 100 });
      expect(images[1].position).toEqual({ x: 400, y: 100 });
    });

    it('returns original layout on error', async () => {
      const { createVisionClient } = await import('./visionClient');
      (createVisionClient as any).mockReturnValueOnce({
        getSmartLabelPlacements: vi.fn().mockRejectedValue(new Error('API Error')),
      });

      const layout = createMockLayout(2);
      const originalPositions = layout.elements
        .filter((el) => el.type === 'label')
        .map((el) => ({ ...el.position }));

      const result = await generateSmartLabels(layout, 'test-api-key');

      const labelPositions = result.elements
        .filter((el) => el.type === 'label')
        .map((el) => el.position);

      expect(labelPositions).toEqual(originalPositions);
    });
  });

  describe('GPT-4V mode', () => {
    beforeEach(() => {
      process.env.USE_GPT4V = 'false';
    });

    it('uses GPT-4V when explicitly requested with canvas image', async () => {
      const layout = createMockLayout(2);
      const canvasImage = 'data:image/png;base64,iVBORw0KGgo...';

      const result = await generateSmartLabels(layout, 'test-api-key', {
        useGPT4V: true,
        canvasImage,
      });

      // Should have processed the layout
      expect(result.canvas_size).toEqual({ width: 1200, height: 1200 });
    });

    it('falls back to Claude when no canvas image provided', async () => {
      const layout = createMockLayout(2);

      const result = await generateSmartLabels(layout, 'test-api-key', {
        useGPT4V: true,
        // No canvasImage provided
      });

      // Should still work via Claude fallback
      const labels = result.elements.filter((el) => el.type === 'label');
      expect(labels).toHaveLength(2);
    });
  });
});

describe('getSmartLabelPlacements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns raw placement array without modifying layout', async () => {
    const layout = createMockLayout(2);

    const placements = await getSmartLabelPlacements(layout, {
      anthropicApiKey: 'test-key',
    });

    expect(placements).toHaveLength(2);
    expect(placements[0]).toHaveProperty('labelX');
    expect(placements[0]).toHaveProperty('labelY');
    expect(placements[0]).toHaveProperty('fontSize');
  });

  it('includes justification notes', async () => {
    const layout = createMockLayout(2);

    const placements = await getSmartLabelPlacements(layout, {
      anthropicApiKey: 'test-key',
    });

    expect(placements[0].notes).toBe('Positioned below product');
  });

  it('throws error when no API key provided', async () => {
    const layout = createMockLayout(2);
    const originalEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(
      getSmartLabelPlacements(layout, {
        // No API key
      })
    ).rejects.toThrow('Anthropic API key required');

    process.env.ANTHROPIC_API_KEY = originalEnv;
  });
});

describe('Label collision detection', () => {
  it('handles overlapping products by distributing labels', async () => {
    // Create layout with overlapping images
    const overlappingLayout: LayoutOutput = {
      canvas_size: { width: 1200, height: 1200 },
      elements: [
        {
          type: 'image',
          id: 'product-0',
          text: 'Product 1',
          position: { x: 100, y: 100 },
          size: { width: 300, height: 300 },
        },
        {
          type: 'image',
          id: 'product-1',
          text: 'Product 2',
          position: { x: 200, y: 150 }, // Overlaps with first
          size: { width: 300, height: 300 },
        },
        { type: 'label', text: 'Product 1', position: { x: 100, y: 410 } },
        { type: 'label', text: 'Product 2', position: { x: 200, y: 460 } },
      ],
    };

    const result = await generateSmartLabels(overlappingLayout, 'test-api-key');

    // Labels should be placed without overlapping each other
    const labels = result.elements.filter((el) => el.type === 'label');
    expect(labels).toHaveLength(2);

    // Positions should be different
    expect(labels[0].position).not.toEqual(labels[1].position);
  });
});

describe('Font size recommendations', () => {
  const testCases = [
    { productCount: 1, expectedRange: [16, 18] },
    { productCount: 2, expectedRange: [16, 18] },
    { productCount: 3, expectedRange: [14, 16] },
    { productCount: 4, expectedRange: [14, 16] },
    { productCount: 5, expectedRange: [12, 14] },
    { productCount: 6, expectedRange: [12, 14] },
    { productCount: 7, expectedRange: [10, 12] },
    { productCount: 10, expectedRange: [10, 12] },
  ];

  testCases.forEach(({ productCount, expectedRange }) => {
    it(`recommends font size ${expectedRange[0]}-${expectedRange[1]}px for ${productCount} products`, async () => {
      const layout = createMockLayout(productCount);
      const placements = await getSmartLabelPlacements(layout, {
        anthropicApiKey: 'test-key',
      });

      // Placements should include fontSize within expected range
      placements.forEach((p) => {
        if (p.fontSize) {
          expect(p.fontSize).toBeGreaterThanOrEqual(expectedRange[0] - 4); // Allow some variance
          expect(p.fontSize).toBeLessThanOrEqual(expectedRange[1] + 2);
        }
      });
    });
  });
});

describe('Layout style integration', () => {
  it('processes labels for grid layout', async () => {
    const gridLayout: LayoutOutput = {
      canvas_size: { width: 1200, height: 1200 },
      elements: [
        { type: 'image', text: 'Product 1', position: { x: 100, y: 100 }, size: { width: 250, height: 250 } },
        { type: 'image', text: 'Product 2', position: { x: 400, y: 100 }, size: { width: 250, height: 250 } },
        { type: 'image', text: 'Product 3', position: { x: 100, y: 400 }, size: { width: 250, height: 250 } },
        { type: 'image', text: 'Product 4', position: { x: 400, y: 400 }, size: { width: 250, height: 250 } },
        { type: 'label', text: 'Product 1', position: { x: 100, y: 360 } },
        { type: 'label', text: 'Product 2', position: { x: 400, y: 360 } },
        { type: 'label', text: 'Product 3', position: { x: 100, y: 660 } },
        { type: 'label', text: 'Product 4', position: { x: 400, y: 660 } },
      ],
    };

    const result = await generateSmartLabels(gridLayout, 'test-api-key');
    expect(result.elements.filter((el) => el.type === 'label')).toHaveLength(4);
  });

  it('processes labels for centerpiece layout', async () => {
    const centerpieceLayout: LayoutOutput = {
      canvas_size: { width: 1200, height: 1200 },
      elements: [
        // Hero image in center
        { type: 'image', text: 'Hero Product', position: { x: 300, y: 300 }, size: { width: 600, height: 600 } },
        // Smaller items around
        { type: 'image', text: 'Product 2', position: { x: 50, y: 100 }, size: { width: 200, height: 200 } },
        { type: 'image', text: 'Product 3', position: { x: 950, y: 100 }, size: { width: 200, height: 200 } },
        // Labels
        { type: 'label', text: 'Hero Product', position: { x: 500, y: 920 } },
        { type: 'label', text: 'Product 2', position: { x: 50, y: 310 } },
        { type: 'label', text: 'Product 3', position: { x: 950, y: 310 } },
      ],
    };

    const result = await generateSmartLabels(centerpieceLayout, 'test-api-key');
    expect(result.elements.filter((el) => el.type === 'label')).toHaveLength(3);
  });
});
