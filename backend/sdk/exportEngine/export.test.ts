/**
 * Export Engine Tests
 */

import { BoardRenderer } from './renderBoard';
import { exportToImage, exportToFile, exportWithAutoName } from './exportToImage';
import { LayoutOutput, ExportFormat } from './types';
import * as fs from 'fs';
import * as path from 'path';

describe('Export Engine', () => {
  const testLayout3Products: LayoutOutput = {
    layout_type: 'ZigZagStaggered',
    canvas_size: { width: 1200, height: 1200 },
    elements: [
      {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
        position: { x: 100, y: 100 },
        size: { width: 400, height: 400 },
        zIndex: 1
      },
      {
        type: 'label',
        text: 'Brand A',
        position: { x: 250, y: 520 },
        style: 'label',
        zIndex: 2
      },
      {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1574180045827-681f8a1a9622?w=400',
        position: { x: 700, y: 300 },
        size: { width: 400, height: 400 },
        zIndex: 1
      },
      {
        type: 'label',
        text: 'Brand B',
        position: { x: 850, y: 720 },
        style: 'label',
        zIndex: 2
      },
      {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=400',
        position: { x: 100, y: 700 },
        size: { width: 400, height: 400 },
        zIndex: 1
      },
      {
        type: 'label',
        text: 'Brand C',
        position: { x: 250, y: 1120 },
        style: 'label',
        zIndex: 2
      }
    ],
    metadata: {
      generated_at: new Date().toISOString(),
      product_count: 3,
      archetype_description: 'ZigZag staggered layout for storytelling flow'
    }
  };

  const testLayoutOverlapping: LayoutOutput = {
    layout_type: 'LayeredCenterpiece',
    canvas_size: { width: 1080, height: 1080 },
    elements: [
      {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
        position: { x: 315, y: 315 },
        size: { width: 450, height: 450 },
        zIndex: 10,
        opacity: 1
      },
      {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1574180045827-681f8a1a9622?w=400',
        position: { x: 165, y: 115 },
        size: { width: 300, height: 300 },
        zIndex: 5,
        rotation: -15,
        opacity: 0.9
      },
      {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=400',
        position: { x: 615, y: 115 },
        size: { width: 300, height: 300 },
        zIndex: 5,
        rotation: 15,
        opacity: 0.9
      }
    ],
    metadata: {
      generated_at: new Date().toISOString(),
      product_count: 3,
      archetype_description: 'Layered centerpiece with hero product'
    }
  };

  const outputDir = path.join(__dirname, 'test-output');

  beforeAll(() => {
    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test output (optional)
    // fs.rmSync(outputDir, { recursive: true, force: true });
  });

  describe('BoardRenderer', () => {
    test('should create renderer with default config', () => {
      const renderer = new BoardRenderer(1200, 1200);
      expect(renderer).toBeDefined();
      expect(renderer.getCanvas()).toBeDefined();
      expect(renderer.getCanvas().width).toBe(1200);
      expect(renderer.getCanvas().height).toBe(1200);
    });

    test('should create renderer with custom config', () => {
      const renderer = new BoardRenderer(1080, 1080, {
        background_color: '#ffffff',
        add_branding: false
      });
      expect(renderer).toBeDefined();
    });

    test('should render 3-product horizontal layout', async () => {
      const renderer = new BoardRenderer(
        testLayout3Products.canvas_size.width,
        testLayout3Products.canvas_size.height
      );

      const canvas = await renderer.render(testLayout3Products);

      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(1200);
      expect(canvas.height).toBe(1200);

      // Save for visual inspection
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(outputDir, 'test-3-products.png'), buffer);
    }, 30000); // 30 second timeout for image loading

    test('should render overlapping layout', async () => {
      const renderer = new BoardRenderer(
        testLayoutOverlapping.canvas_size.width,
        testLayoutOverlapping.canvas_size.height
      );

      const canvas = await renderer.render(testLayoutOverlapping);

      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(1080);
      expect(canvas.height).toBe(1080);

      // Save for visual inspection
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(outputDir, 'test-overlapping.png'), buffer);
    }, 30000);

    test('should render without labels', async () => {
      const layoutNoLabels: LayoutOutput = {
        ...testLayout3Products,
        elements: testLayout3Products.elements.filter(el => el.type === 'image')
      };

      const renderer = new BoardRenderer(1200, 1200);
      const canvas = await renderer.render(layoutNoLabels);

      expect(canvas).toBeDefined();

      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(outputDir, 'test-no-labels.png'), buffer);
    }, 30000);

    test('should render with branding', async () => {
      const renderer = new BoardRenderer(1200, 1200, {
        add_branding: true,
        branding_position: 'bottom-right'
      });

      const canvas = await renderer.render(testLayout3Products);
      expect(canvas).toBeDefined();
    }, 30000);

    test('should render without branding', async () => {
      const renderer = new BoardRenderer(1200, 1200, {
        add_branding: false
      });

      const canvas = await renderer.render(testLayout3Products);
      expect(canvas).toBeDefined();
    }, 30000);
  });

  describe('Image Export', () => {
    test('should export to PNG', async () => {
      const renderer = new BoardRenderer(800, 800);
      const canvas = await renderer.render({
        layout_type: 'MinimalSplit',
        canvas_size: { width: 800, height: 800 },
        elements: []
      });

      const buffer = await exportToImage(canvas, 'png');

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer[0]).toBe(0x89); // PNG magic number
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4E);
      expect(buffer[3]).toBe(0x47);
    });

    test('should export to JPG', async () => {
      const renderer = new BoardRenderer(800, 800);
      const canvas = await renderer.render({
        layout_type: 'MinimalSplit',
        canvas_size: { width: 800, height: 800 },
        elements: []
      });

      const buffer = await exportToImage(canvas, 'jpg', 85);

      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer[0]).toBe(0xFF); // JPEG magic number
      expect(buffer[1]).toBe(0xD8);
    });

    test('should export to file', async () => {
      const renderer = new BoardRenderer(600, 600);
      const canvas = await renderer.render({
        layout_type: 'MinimalSplit',
        canvas_size: { width: 600, height: 600 },
        elements: []
      });

      const filePath = path.join(outputDir, 'export-test.png');
      await exportToFile(canvas, filePath, 'png');

      expect(fs.existsSync(filePath)).toBe(true);
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(0);
    });

    test('should export with auto naming', async () => {
      const renderer = new BoardRenderer(600, 600);
      const canvas = await renderer.render({
        layout_type: 'MinimalSplit',
        canvas_size: { width: 600, height: 600 },
        elements: []
      });

      const filePath = await exportWithAutoName(canvas, outputDir, 'png');

      expect(fs.existsSync(filePath)).toBe(true);
      expect(filePath).toContain('moodboard-');
      expect(filePath).toContain('.png');
    });
  });

  describe('Export Dimensions', () => {
    const testCases: Array<[number, number, string]> = [
      [1080, 1080, 'Instagram square'],
      [1080, 1350, 'Instagram portrait'],
      [1000, 1500, 'Pinterest'],
      [1920, 1080, 'Landscape']
    ];

    test.each(testCases)(
      'should export %dx%d (%s)',
      async (width, height, description) => {
        const renderer = new BoardRenderer(width, height);
        const canvas = await renderer.render({
          layout_type: 'MinimalSplit',
          canvas_size: { width, height },
          elements: []
        });

        expect(canvas.width).toBe(width);
        expect(canvas.height).toBe(height);

        const buffer = await exportToImage(canvas, 'png');
        expect(buffer.length).toBeGreaterThan(0);
      }
    );
  });

  describe('Error Handling', () => {
    test('should handle missing image gracefully', async () => {
      const layoutWithBadImage: LayoutOutput = {
        layout_type: 'MinimalSplit',
        canvas_size: { width: 800, height: 800 },
        elements: [
          {
            type: 'image',
            src: 'https://invalid-url-that-does-not-exist.com/image.jpg',
            position: { x: 100, y: 100 },
            size: { width: 300, height: 300 },
            zIndex: 1
          }
        ]
      };

      const renderer = new BoardRenderer(800, 800);

      // Should not throw, should render placeholder
      const canvas = await renderer.render(layoutWithBadImage);
      expect(canvas).toBeDefined();

      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(outputDir, 'test-bad-image.png'), buffer);
    }, 30000);

    test('should handle element without required fields', async () => {
      const layoutWithIncompleteElement: LayoutOutput = {
        layout_type: 'MinimalSplit',
        canvas_size: { width: 800, height: 800 },
        elements: [
          {
            type: 'image',
            position: { x: 100, y: 100 },
            zIndex: 1
            // Missing src and size
          } as any
        ]
      };

      const renderer = new BoardRenderer(800, 800);
      const canvas = await renderer.render(layoutWithIncompleteElement);
      expect(canvas).toBeDefined();
    });
  });
});
