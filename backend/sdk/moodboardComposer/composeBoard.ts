/**
 * Moodboard Composer
 * Composes complete moodboard with products, theme, layout, and labels
 */

import { LayoutOutput } from '../layoutGenerator/types';
import { ThemeTokens } from '../themeTokens/generateTokens';

export interface MoodboardComposition {
  id: string;
  name: string;
  created_at: string;
  layout: LayoutOutput;
  products: Array<{
    id: string;
    product_name: string;
    brand: string;
    category: string;
    tags: string[];
    color_palette: string[];
    price?: number;
  }>;
  theme: ThemeTokens;
  metadata: {
    canvas_size: { width: number; height: number };
    product_count: number;
    layout_type: string;
    has_branding: boolean;
    generated_by: string;
  };
}

export interface ComposeBoardRequest {
  name?: string;
  layout: LayoutOutput;
  products: any[];
  theme: ThemeTokens;
  add_branding?: boolean;
}

/**
 * Compose complete moodboard object
 */
export async function composeBoard(request: ComposeBoardRequest): Promise<MoodboardComposition> {
  const {
    name = `Moodboard ${new Date().toLocaleDateString()}`,
    layout,
    products,
    theme,
    add_branding = true
  } = request;

  // Generate unique ID
  const id = generateBoardId();

  // Clean product data
  const cleanedProducts = products.map(p => ({
    id: p.id,
    product_name: p.product_name,
    brand: p.brand,
    category: p.category,
    tags: p.tags || [],
    color_palette: p.color_palette || [],
    price: p.price
  }));

  // Create composition
  const composition: MoodboardComposition = {
    id,
    name,
    created_at: new Date().toISOString(),
    layout,
    products: cleanedProducts,
    theme,
    metadata: {
      canvas_size: layout.canvas_size,
      product_count: products.length,
      layout_type: layout.layout_type,
      has_branding: add_branding,
      generated_by: 'Mood Layer SDK'
    }
  };

  return composition;
}

/**
 * Generate unique board ID
 */
function generateBoardId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `board_${timestamp}_${randomStr}`;
}

/**
 * Validate moodboard composition
 */
export function validateComposition(composition: MoodboardComposition): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!composition.id) {
    errors.push('Missing board ID');
  }

  if (!composition.name) {
    errors.push('Missing board name');
  }

  if (!composition.layout || !composition.layout.elements) {
    errors.push('Invalid layout data');
  }

  if (!composition.products || composition.products.length === 0) {
    errors.push('No products in composition');
  }

  if (!composition.theme || !composition.theme.colors) {
    errors.push('Invalid theme data');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get composition summary
 */
export function getCompositionSummary(composition: MoodboardComposition): string {
  const { name, metadata } = composition;
  const { product_count, layout_type, canvas_size } = metadata;

  return `${name}: ${product_count} products in ${layout_type} layout (${canvas_size.width}x${canvas_size.height}px)`;
}
