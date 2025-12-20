/**
 * Layout Generation Engine
 * Generates moodboard layouts using predefined archetypes
 */

import {
  LayoutInput,
  LayoutOutput,
  LayoutElement,
  ProductInput,
  Position,
  Size,
  BoundingBox,
  LayoutConfig,
  LayoutArchetypeName,
  FitTag
} from './types';
import { getArchetype } from './layoutArchetypes';

/**
 * Fit tag priority for layout placement
 * Lower number = placed earlier/more prominently
 */
const FIT_TAG_PRIORITY: Record<FitTag, number> = {
  bulky: 1,       // Large items placed first (hero position)
  oversized: 2,   // Also large, secondary
  flat: 3,        // Medium priority
  delicate: 4,    // Careful placement, often smaller
  lightweight: 5, // Can be placed anywhere, flexible
};

/**
 * Default layout configuration
 */
const DEFAULT_CONFIG: LayoutConfig = {
  padding: 80,
  minImageSize: 200,
  maxImageSize: 500,
  labelOffset: 20,
  allowRotation: true,
  maxRotation: 15
};

/**
 * Layout Generator Class
 */
export class LayoutGenerator {
  private config: LayoutConfig;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate layout from input
   */
  async generateLayout(input: LayoutInput): Promise<LayoutOutput> {
    const archetype = getArchetype(input.layout_type);
    const canvasSize = input.canvas_size || archetype.defaultCanvasSize;

    // Validate product count
    if (input.products.length < archetype.minItems) {
      throw new Error(
        `${archetype.name} requires at least ${archetype.minItems} products (got ${input.products.length})`
      );
    }

    if (input.products.length > archetype.maxItems) {
      throw new Error(
        `${archetype.name} supports max ${archetype.maxItems} products (got ${input.products.length})`
      );
    }

    // Sort products by fit tags for optimal placement
    const sortedProducts = this.sortByFitTags(input.products);

    // Generate layout elements based on archetype
    const elements = await this.generateArchetypeLayout(
      input.layout_type,
      sortedProducts,
      canvasSize,
      input.show_labels !== false,
      input.show_prices === true
    );

    return {
      layout_type: input.layout_type,
      canvas_size: canvasSize,
      elements,
      metadata: {
        generated_at: new Date().toISOString(),
        product_count: input.products.length,
        archetype_description: archetype.description
      }
    };
  }

  /**
   * Sort products by fit tags for optimal layout placement
   * Bulky/oversized items are placed first (hero positions)
   * Delicate/lightweight items are placed in supporting positions
   */
  private sortByFitTags(products: ProductInput[]): ProductInput[] {
    return [...products].sort((a, b) => {
      const priorityA = this.getFitTagPriority(a.fit_tags);
      const priorityB = this.getFitTagPriority(b.fit_tags);
      return priorityA - priorityB;
    });
  }

  /**
   * Get priority score for a product based on its fit tags
   * Lower score = higher priority (placed first)
   */
  private getFitTagPriority(fitTags?: FitTag[]): number {
    if (!fitTags || fitTags.length === 0) {
      return 10; // Default: no tags = lowest priority
    }

    // Return lowest priority among all tags
    return Math.min(...fitTags.map(tag => FIT_TAG_PRIORITY[tag] || 10));
  }

  /**
   * Calculate image size based on product dimensions and fit tags
   * Bulky items get larger display, delicate items get smaller
   */
  private calculateDimensionAwareSize(
    product: ProductInput,
    baseSize: number,
    minSize: number = 200,
    maxSize: number = 500
  ): number {
    let sizeMultiplier = 1.0;

    // Adjust based on fit tags
    if (product.fit_tags) {
      if (product.fit_tags.includes('bulky') || product.fit_tags.includes('oversized')) {
        sizeMultiplier = 1.3; // 30% larger
      } else if (product.fit_tags.includes('delicate')) {
        sizeMultiplier = 0.8; // 20% smaller
      } else if (product.fit_tags.includes('lightweight')) {
        sizeMultiplier = 0.9; // 10% smaller
      }
    }

    // Adjust based on physical dimensions if available
    if (product.dimensions) {
      const { width, height, depth } = product.dimensions;
      const volume = (width || 0) * (height || 0) * (depth || 1);

      // Scale based on relative volume (assuming typical products are ~1000-5000 cm³)
      if (volume > 10000) {
        sizeMultiplier *= 1.2; // Large items
      } else if (volume < 500) {
        sizeMultiplier *= 0.85; // Small items
      }
    }

    // Calculate final size with bounds
    const calculatedSize = baseSize * sizeMultiplier;
    return Math.max(minSize, Math.min(maxSize, calculatedSize));
  }

  /**
   * Check if product has "delicate" fit tag (requires careful placement)
   */
  private isDelicateProduct(product: ProductInput): boolean {
    return product.fit_tags?.includes('delicate') ?? false;
  }

  /**
   * Check if product is bulky (should be prominent)
   */
  private isBulkyProduct(product: ProductInput): boolean {
    return product.fit_tags?.includes('bulky') || product.fit_tags?.includes('oversized') || false;
  }

  /**
   * Generate layout for specific archetype
   */
  private async generateArchetypeLayout(
    archetype: LayoutArchetypeName,
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): Promise<LayoutElement[]> {
    switch (archetype) {
      case 'ZigZagStaggered':
        return this.generateZigZagLayout(products, canvasSize, showLabels, showPrices);

      case 'LayeredCenterpiece':
        return this.generateLayeredCenterpieceLayout(products, canvasSize, showLabels, showPrices);

      case 'MinimalSplit':
        return this.generateMinimalSplitLayout(products, canvasSize, showLabels, showPrices);

      case 'GridWithOverlap':
        return this.generateGridWithOverlapLayout(products, canvasSize, showLabels, showPrices);

      case 'DiagonalCascade':
        return this.generateDiagonalCascadeLayout(products, canvasSize, showLabels, showPrices);

      case 'SymmetricBalance':
        return this.generateSymmetricBalanceLayout(products, canvasSize, showLabels, showPrices);

      case 'AsymmetricFlow':
        return this.generateAsymmetricFlowLayout(products, canvasSize, showLabels, showPrices);

      case 'CollageStyle':
        return this.generateCollageStyleLayout(products, canvasSize, showLabels, showPrices);

      default:
        throw new Error(`Unknown archetype: ${archetype}`);
    }
  }

  /**
   * ZigZag Staggered Layout
   * Alternating left-right with vertical offset
   */
  private generateZigZagLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];
    const imageSize = 350;
    const verticalSpacing = 250;
    const horizontalMargin = this.config.padding + 100;

    products.forEach((product, i) => {
      const isLeft = i % 2 === 0;
      const x = isLeft ? horizontalMargin : canvasSize.width - horizontalMargin - imageSize;
      const y = this.config.padding + i * verticalSpacing;

      // Image
      elements.push({
        type: 'image',
        src: product.image_url,
        position: { x, y },
        size: { width: imageSize, height: imageSize },
        zIndex: i
      });

      // Label
      if (showLabels) {
        elements.push({
          type: 'label',
          text: product.brand,
          position: { x: x + 10, y: y + imageSize + this.config.labelOffset },
          style: 'label',
          zIndex: i + 100
        });
      }
    });

    return elements;
  }

  /**
   * Layered Centerpiece Layout
   * Central hero with supporting elements
   */
  private generateLayeredCenterpieceLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    // Hero image (first product)
    const heroSize = 450;
    elements.push({
      type: 'image',
      src: products[0].image_url,
      position: { x: centerX - heroSize / 2, y: centerY - heroSize / 2 },
      size: { width: heroSize, height: heroSize },
      zIndex: 10
    });

    if (showLabels) {
      elements.push({
        type: 'label',
        text: products[0].brand,
        position: { x: centerX - 50, y: centerY + heroSize / 2 + 30 },
        style: 'label',
        zIndex: 20
      });
    }

    // Supporting products in a circle
    const radius = 350;
    const supportingProducts = products.slice(1);
    const angleStep = (2 * Math.PI) / supportingProducts.length;

    supportingProducts.forEach((product, i) => {
      const angle = i * angleStep;
      const size = 200;
      const x = centerX + radius * Math.cos(angle) - size / 2;
      const y = centerY + radius * Math.sin(angle) - size / 2;

      elements.push({
        type: 'image',
        src: product.image_url,
        position: { x, y },
        size: { width: size, height: size },
        zIndex: i,
        rotation: this.config.allowRotation ? this.randomRotation() : 0
      });

      if (showLabels) {
        elements.push({
          type: 'text',
          text: product.brand,
          position: { x: x + 10, y: y + size + 15 },
          style: 'caption',
          zIndex: i + 100
        });
      }
    });

    return elements;
  }

  /**
   * Minimal Split Layout
   * Clean split with whitespace
   */
  private generateMinimalSplitLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];
    const imageSize = 400;
    const spacing = 150;

    if (products.length === 2) {
      // Side by side
      const leftX = canvasSize.width / 2 - imageSize - spacing / 2;
      const rightX = canvasSize.width / 2 + spacing / 2;
      const y = canvasSize.height / 2 - imageSize / 2;

      [leftX, rightX].forEach((x, i) => {
        elements.push({
          type: 'image',
          src: products[i].image_url,
          position: { x, y },
          size: { width: imageSize, height: imageSize },
          zIndex: i
        });

        if (showLabels) {
          elements.push({
            type: 'label',
            text: products[i].brand,
            position: { x: x + 10, y: y + imageSize + this.config.labelOffset },
            style: 'label',
            zIndex: i + 10
          });
        }
      });
    } else {
      // Vertical stack
      const x = canvasSize.width / 2 - imageSize / 2;
      const startY = (canvasSize.height - (products.length * (imageSize + spacing))) / 2;

      products.forEach((product, i) => {
        const y = startY + i * (imageSize + spacing);

        elements.push({
          type: 'image',
          src: product.image_url,
          position: { x, y },
          size: { width: imageSize, height: imageSize },
          zIndex: i
        });

        if (showLabels) {
          elements.push({
            type: 'label',
            text: product.brand,
            position: { x: x + 10, y: y + imageSize + 20 },
            style: 'label',
            zIndex: i + 10
          });
        }
      });
    }

    return elements;
  }

  /**
   * Grid With Overlap Layout
   */
  private generateGridWithOverlapLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];
    const cols = Math.ceil(Math.sqrt(products.length));
    const rows = Math.ceil(products.length / cols);

    const imageSize = 300;
    const overlapAmount = 40;
    const gridWidth = cols * (imageSize - overlapAmount);
    const gridHeight = rows * (imageSize - overlapAmount);

    const startX = (canvasSize.width - gridWidth) / 2;
    const startY = (canvasSize.height - gridHeight) / 2;

    products.forEach((product, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = startX + col * (imageSize - overlapAmount);
      const y = startY + row * (imageSize - overlapAmount);

      elements.push({
        type: 'image',
        src: product.image_url,
        position: { x, y },
        size: { width: imageSize, height: imageSize },
        zIndex: i
      });

      if (showLabels) {
        elements.push({
          type: 'text',
          text: product.brand,
          position: { x: x + 10, y: y + imageSize - 30 },
          style: 'caption',
          zIndex: i + 100
        });
      }
    });

    return elements;
  }

  /**
   * Diagonal Cascade Layout
   */
  private generateDiagonalCascadeLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];
    const startX = this.config.padding;
    const startY = this.config.padding;
    const stepX = (canvasSize.width - 2 * this.config.padding - 300) / (products.length - 1);
    const stepY = (canvasSize.height - 2 * this.config.padding - 300) / (products.length - 1);

    products.forEach((product, i) => {
      const size = 350 - i * 30; // Decreasing size
      const x = startX + i * stepX;
      const y = startY + i * stepY;

      elements.push({
        type: 'image',
        src: product.image_url,
        position: { x, y },
        size: { width: size, height: size },
        zIndex: products.length - i, // Reverse z-index
        rotation: this.config.allowRotation ? i * 3 : 0
      });

      if (showLabels) {
        elements.push({
          type: 'label',
          text: product.brand,
          position: { x: x + 10, y: y + size + 15 },
          style: 'label',
          zIndex: products.length + i
        });
      }
    });

    return elements;
  }

  /**
   * Symmetric Balance Layout
   */
  private generateSymmetricBalanceLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];
    const centerX = canvasSize.width / 2;
    const imageSize = 280;
    const spacing = 60;

    const half = Math.ceil(products.length / 2);
    const leftSide = products.slice(0, half);
    const rightSide = products.slice(half);

    // Left side
    leftSide.forEach((product, i) => {
      const x = centerX - spacing - imageSize - (i * 50);
      const y = this.config.padding + i * (imageSize + spacing);

      elements.push({
        type: 'image',
        src: product.image_url,
        position: { x, y },
        size: { width: imageSize, height: imageSize },
        zIndex: i
      });

      if (showLabels) {
        elements.push({
          type: 'label',
          text: product.brand,
          position: { x: x + 10, y: y + imageSize + 15 },
          style: 'label',
          zIndex: i + 100
        });
      }
    });

    // Right side (mirror)
    rightSide.forEach((product, i) => {
      const x = centerX + spacing + (i * 50);
      const y = this.config.padding + i * (imageSize + spacing);

      elements.push({
        type: 'image',
        src: product.image_url,
        position: { x, y },
        size: { width: imageSize, height: imageSize },
        zIndex: i
      });

      if (showLabels) {
        elements.push({
          type: 'label',
          text: product.brand,
          position: { x: x + 10, y: y + imageSize + 15 },
          style: 'label',
          zIndex: i + 100
        });
      }
    });

    return elements;
  }

  /**
   * Asymmetric Flow Layout
   */
  private generateAsymmetricFlowLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];

    // Varied positions with intentional imbalance
    const positions = [
      { x: 100, y: 100, size: 400 },
      { x: 600, y: 200, size: 300 },
      { x: 150, y: 600, size: 350 },
      { x: 700, y: 650, size: 280 },
      { x: 400, y: 350, size: 250 },
      { x: 850, y: 100, size: 300 },
      { x: 300, y: 950, size: 320 }
    ];

    products.forEach((product, i) => {
      const pos = positions[i % positions.length];

      elements.push({
        type: 'image',
        src: product.image_url,
        position: { x: pos.x, y: pos.y },
        size: { width: pos.size, height: pos.size },
        zIndex: i,
        rotation: this.config.allowRotation ? this.randomRotation() : 0
      });

      if (showLabels) {
        elements.push({
          type: 'label',
          text: product.brand,
          position: { x: pos.x + 10, y: pos.y + pos.size + 15 },
          style: 'label',
          zIndex: i + 100
        });
      }
    });

    return elements;
  }

  /**
   * Collage Style Layout
   */
  private generateCollageStyleLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];

    products.forEach((product, i) => {
      const size = this.randomInt(250, 450);
      const x = this.randomInt(this.config.padding, canvasSize.width - size - this.config.padding);
      const y = this.randomInt(this.config.padding, canvasSize.height - size - this.config.padding);

      elements.push({
        type: 'image',
        src: product.image_url,
        position: { x, y },
        size: { width: size, height: size },
        zIndex: i,
        rotation: this.config.allowRotation ? this.randomRotation() : 0,
        opacity: this.random(0.9, 1.0)
      });

      if (showLabels) {
        elements.push({
          type: 'label',
          text: product.brand,
          position: { x: x + 10, y: y + size + 10 },
          style: 'caption',
          zIndex: i + 100
        });
      }
    });

    return elements;
  }

  /**
   * Helper: Random rotation within max range
   */
  private randomRotation(): number {
    return this.random(-this.config.maxRotation, this.config.maxRotation);
  }

  /**
   * Helper: Random float between min and max
   */
  private random(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Helper: Random integer between min and max
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(this.random(min, max));
  }

  /**
   * Helper: Check if two bounding boxes overlap
   */
  private boxesOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
    return !(
      box1.x + box1.width < box2.x ||
      box2.x + box2.width < box1.x ||
      box1.y + box1.height < box2.y ||
      box2.y + box2.height < box1.y
    );
  }

  /**
   * Helper: Check if element is within canvas bounds
   */
  private isWithinCanvas(element: LayoutElement, canvasSize: Size): boolean {
    if (!element.size) return true;

    return (
      element.position.x >= 0 &&
      element.position.y >= 0 &&
      element.position.x + element.size.width <= canvasSize.width &&
      element.position.y + element.size.height <= canvasSize.height
    );
  }
}

/**
 * Factory function to create LayoutGenerator
 */
export function createLayoutGenerator(config?: Partial<LayoutConfig>): LayoutGenerator {
  return new LayoutGenerator(config);
}
