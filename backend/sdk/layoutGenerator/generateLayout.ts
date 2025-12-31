/**
 * Layout Generation Engine (v4)
 * Generates moodboard layouts using 4 simplified archetypes
 * Vision AI can influence placement within each archetype framework
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
  FitTag,
  VisionLayoutHint,
  VisionLayoutAnalysis
} from './types';
import { getArchetype, ARCHETYPE_CHARACTERISTICS, resolveLegacyArchetype } from './layoutArchetypes';

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
  private visionAnalysis?: VisionLayoutAnalysis;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set Vision AI analysis to influence layout decisions
   */
  setVisionAnalysis(analysis: VisionLayoutAnalysis): void {
    this.visionAnalysis = analysis;
  }

  /**
   * Generate layout from input
   */
  async generateLayout(input: LayoutInput): Promise<LayoutOutput> {
    // Resolve legacy archetype names to new ones
    const resolvedType = resolveLegacyArchetype(input.layout_type);
    const archetype = getArchetype(resolvedType);
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
      resolvedType,
      sortedProducts,
      canvasSize,
      input.show_labels !== false,
      input.show_prices === true
    );

    return {
      layout_type: resolvedType,
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
   */
  private getFitTagPriority(fitTags?: FitTag[]): number {
    if (!fitTags || fitTags.length === 0) {
      return 10;
    }
    return Math.min(...fitTags.map(tag => FIT_TAG_PRIORITY[tag] || 10));
  }

  /**
   * Get Vision AI hint for a product if available
   */
  private getVisionHint(productId: string): VisionLayoutHint | undefined {
    return this.visionAnalysis?.productHints.get(productId);
  }

  /**
   * Calculate image size based on Vision AI hints, fit tags, and dimensions
   */
  private calculateSize(
    product: ProductInput,
    baseSize: number,
    archetype: LayoutArchetypeName
  ): number {
    const characteristics = ARCHETYPE_CHARACTERISTICS[archetype];
    const [minScale, maxScale] = characteristics.scalingRange;

    // Start with Vision AI hint if available
    const hint = product.product_name ? this.getVisionHint(product.product_name) : undefined;
    let sizeMultiplier = hint?.scaleFactor || 1.0;

    // Adjust based on fit tags
    if (product.fit_tags) {
      if (product.fit_tags.includes('bulky') || product.fit_tags.includes('oversized')) {
        sizeMultiplier *= 1.2;
      } else if (product.fit_tags.includes('delicate')) {
        sizeMultiplier *= 0.85;
      } else if (product.fit_tags.includes('lightweight')) {
        sizeMultiplier *= 0.9;
      }
    }

    // Apply archetype scaling constraints
    const scaledSize = baseSize * sizeMultiplier;
    const minSize = baseSize * minScale;
    const maxSize = baseSize * maxScale;

    return Math.max(this.config.minImageSize, Math.min(this.config.maxImageSize,
      Math.max(minSize, Math.min(maxSize, scaledSize))
    ));
  }

  /**
   * Get rotation for element based on Vision AI and archetype
   */
  private getRotation(product: ProductInput, archetype: LayoutArchetypeName): number {
    if (!this.config.allowRotation) return 0;

    const characteristics = ARCHETYPE_CHARACTERISTICS[archetype];
    const maxRot = characteristics.maxRotation;

    if (maxRot === 0) return 0;

    // Check Vision AI hint
    const hint = product.product_name ? this.getVisionHint(product.product_name) : undefined;
    if (hint?.suggestedRotation !== undefined) {
      return Math.max(-maxRot, Math.min(maxRot, hint.suggestedRotation));
    }

    return this.random(-maxRot, maxRot);
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
      case 'Minimal':
        return this.generateMinimalLayout(products, canvasSize, showLabels, showPrices);

      case 'Hero':
        return this.generateHeroLayout(products, canvasSize, showLabels, showPrices);

      case 'Dynamic':
        return this.generateDynamicLayout(products, canvasSize, showLabels, showPrices);

      case 'Collage':
        return this.generateCollageLayout(products, canvasSize, showLabels, showPrices);

      default:
        // Fallback for any edge cases
        return this.generateDynamicLayout(products, canvasSize, showLabels, showPrices);
    }
  }

  /**
   * Minimal Layout
   * Clean, whitespace-focused with clear focal points
   * No rotation, generous spacing, even visual weight distribution
   */
  private generateMinimalLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];
    const baseSize = 350;
    const spacing = 120;

    if (products.length === 2) {
      // Side by side with generous space
      const imageSize = this.calculateSize(products[0], baseSize, 'Minimal');
      const totalWidth = imageSize * 2 + spacing;
      const startX = (canvasSize.width - totalWidth) / 2;
      const y = (canvasSize.height - imageSize) / 2;

      products.forEach((product, i) => {
        const size = this.calculateSize(product, baseSize, 'Minimal');
        const x = startX + i * (imageSize + spacing);

        elements.push({
          type: 'image',
          id: `product-${i}`,
          src: product.image_url,
          position: { x, y },
          size: { width: size, height: size },
          zIndex: i
        });

        if (showLabels) {
          elements.push({
            type: 'label',
            text: product.brand,
            position: { x: x + 10, y: y + size + this.config.labelOffset },
            style: 'label',
            zIndex: i + 100
          });
        }
      });
    } else {
      // Centered vertical arrangement
      const totalHeight = products.reduce((sum, p) => {
        return sum + this.calculateSize(p, baseSize * 0.9, 'Minimal') + spacing;
      }, -spacing);
      const startY = (canvasSize.height - totalHeight) / 2;
      let currentY = startY;

      products.forEach((product, i) => {
        const size = this.calculateSize(product, baseSize * 0.9, 'Minimal');
        const x = (canvasSize.width - size) / 2;

        elements.push({
          type: 'image',
          id: `product-${i}`,
          src: product.image_url,
          position: { x, y: currentY },
          size: { width: size, height: size },
          zIndex: i
        });

        if (showLabels) {
          elements.push({
            type: 'label',
            text: product.brand,
            position: { x: x + 10, y: currentY + size + this.config.labelOffset },
            style: 'label',
            zIndex: i + 100
          });
        }

        currentY += size + spacing;
      });
    }

    return elements;
  }

  /**
   * Hero Layout
   * Central hero product with supporting items around it
   * Slight rotation allowed, symmetrical balance
   */
  private generateHeroLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    // Hero image (first product - bulky items sorted first)
    const heroSize = this.calculateSize(products[0], 450, 'Hero');

    elements.push({
      type: 'image',
      id: 'product-hero',
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

    // Supporting products arranged around hero
    const supportingProducts = products.slice(1);
    const radius = Math.min(canvasSize.width, canvasSize.height) * 0.35;
    const angleStep = (2 * Math.PI) / supportingProducts.length;
    const startAngle = -Math.PI / 2; // Start from top

    supportingProducts.forEach((product, i) => {
      const angle = startAngle + i * angleStep;
      const size = this.calculateSize(product, 200, 'Hero');
      const x = centerX + radius * Math.cos(angle) - size / 2;
      const y = centerY + radius * Math.sin(angle) - size / 2;

      elements.push({
        type: 'image',
        id: `product-${i + 1}`,
        src: product.image_url,
        position: { x, y },
        size: { width: size, height: size },
        zIndex: i,
        rotation: this.getRotation(product, 'Hero')
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
   * Dynamic Layout
   * Flowing editorial style with visual rhythm and movement
   * Varied sizes, diagonal flow, intentional asymmetry
   */
  private generateDynamicLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];

    // Create a flowing path through the canvas
    const pathPoints = this.generateFlowPath(products.length, canvasSize);

    products.forEach((product, i) => {
      const point = pathPoints[i];
      const size = this.calculateSize(product, point.baseSize, 'Dynamic');

      // Adjust position to keep within bounds
      const x = Math.max(this.config.padding,
        Math.min(canvasSize.width - size - this.config.padding, point.x - size / 2));
      const y = Math.max(this.config.padding,
        Math.min(canvasSize.height - size - this.config.padding, point.y - size / 2));

      elements.push({
        type: 'image',
        id: `product-${i}`,
        src: product.image_url,
        position: { x, y },
        size: { width: size, height: size },
        zIndex: point.zIndex,
        rotation: this.getRotation(product, 'Dynamic')
      });

      if (showLabels) {
        elements.push({
          type: 'label',
          text: product.brand,
          position: { x: x + 10, y: y + size + 15 },
          style: 'label',
          zIndex: point.zIndex + 100
        });
      }
    });

    return elements;
  }

  /**
   * Generate flow path points for Dynamic layout
   */
  private generateFlowPath(count: number, canvasSize: Size): Array<{x: number, y: number, baseSize: number, zIndex: number}> {
    const points: Array<{x: number, y: number, baseSize: number, zIndex: number}> = [];
    const padding = this.config.padding;

    // Create a zigzag flow with some randomness
    for (let i = 0; i < count; i++) {
      const progress = i / (count - 1 || 1);
      const isLeft = i % 2 === 0;

      // Base position follows a diagonal with alternating sides
      const baseX = isLeft
        ? padding + canvasSize.width * 0.1 + this.random(0, canvasSize.width * 0.2)
        : canvasSize.width * 0.6 + this.random(0, canvasSize.width * 0.2);

      const baseY = padding + progress * (canvasSize.height - 2 * padding - 300);

      // Size varies based on position (larger at start)
      const baseSize = 380 - progress * 100 + this.random(-30, 30);

      points.push({
        x: baseX,
        y: baseY,
        baseSize: Math.max(250, baseSize),
        zIndex: count - i // First items on top
      });
    }

    return points;
  }

  /**
   * Collage Layout
   * Organic, magazine-style with varied sizes, rotations, and overlaps
   * Maximum creative freedom within bounds
   */
  private generateCollageLayout(
    products: ProductInput[],
    canvasSize: Size,
    showLabels: boolean,
    showPrices: boolean
  ): LayoutElement[] {
    const elements: LayoutElement[] = [];
    const placedBoxes: BoundingBox[] = [];

    products.forEach((product, i) => {
      const baseSize = this.random(280, 420);
      const size = this.calculateSize(product, baseSize, 'Collage');

      // Try to find a good position (allow some overlap)
      let x: number, y: number;
      let attempts = 0;
      const maxAttempts = 30;

      do {
        x = this.randomInt(this.config.padding, canvasSize.width - size - this.config.padding);
        y = this.randomInt(this.config.padding, canvasSize.height - size - this.config.padding);
        attempts++;
      } while (
        attempts < maxAttempts &&
        this.hasExcessiveOverlap({ x, y, width: size, height: size }, placedBoxes)
      );

      placedBoxes.push({ x, y, width: size, height: size });

      elements.push({
        type: 'image',
        id: `product-${i}`,
        src: product.image_url,
        position: { x, y },
        size: { width: size, height: size },
        zIndex: i,
        rotation: this.getRotation(product, 'Collage'),
        opacity: this.random(0.92, 1.0)
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
   * Check if a box has excessive overlap with placed boxes
   * Some overlap is OK for Collage style, but avoid too much
   */
  private hasExcessiveOverlap(box: BoundingBox, placedBoxes: BoundingBox[]): boolean {
    for (const placed of placedBoxes) {
      const overlap = this.calculateOverlapRatio(box, placed);
      if (overlap > 0.4) { // Allow up to 40% overlap
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate overlap ratio between two boxes (0-1)
   */
  private calculateOverlapRatio(box1: BoundingBox, box2: BoundingBox): number {
    const xOverlap = Math.max(0,
      Math.min(box1.x + box1.width, box2.x + box2.width) - Math.max(box1.x, box2.x)
    );
    const yOverlap = Math.max(0,
      Math.min(box1.y + box1.height, box2.y + box2.height) - Math.max(box1.y, box2.y)
    );
    const overlapArea = xOverlap * yOverlap;
    const smallerArea = Math.min(box1.width * box1.height, box2.width * box2.height);

    return smallerArea > 0 ? overlapArea / smallerArea : 0;
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
}

/**
 * Factory function to create LayoutGenerator
 */
export function createLayoutGenerator(config?: Partial<LayoutConfig>): LayoutGenerator {
  return new LayoutGenerator(config);
}
