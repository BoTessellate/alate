/**
 * Layout Archetypes Library (v3)
 * Predefined layout composition rules for moodboards
 */

import { LayoutArchetype, LayoutArchetypeName } from './types';

/**
 * Library of layout archetypes
 * Each defines rules for positioning products on a moodboard
 */
export const LAYOUT_ARCHETYPES: Record<LayoutArchetypeName, LayoutArchetype> = {
  /**
   * ZigZag Staggered
   * Alternating left-right placement with vertical offset
   * Best for: 3-7 products, storytelling flow
   */
  ZigZagStaggered: {
    name: 'ZigZagStaggered',
    description: 'Alternating zigzag pattern with staggered heights',
    minItems: 3,
    maxItems: 7,
    allowOverlap: false,
    balanceRule: 'dynamic',
    defaultCanvasSize: { width: 1200, height: 1600 }
  },

  /**
   * Layered Centerpiece
   * Central focus with supporting elements layered around
   * Best for: 3-5 products, hero product showcase
   */
  LayeredCenterpiece: {
    name: 'LayeredCenterpiece',
    description: 'Central hero image with layered supporting products',
    minItems: 3,
    maxItems: 5,
    allowOverlap: true,
    balanceRule: 'symmetry',
    defaultCanvasSize: { width: 1200, height: 1200 }
  },

  /**
   * Minimal Split
   * Clean split layout with negative space
   * Best for: 2-4 products, minimalist aesthetic
   */
  MinimalSplit: {
    name: 'MinimalSplit',
    description: 'Clean split with generous whitespace',
    minItems: 2,
    maxItems: 4,
    allowOverlap: false,
    balanceRule: 'whitespace',
    defaultCanvasSize: { width: 1200, height: 1600 }
  },

  /**
   * Grid With Overlap
   * Grid-based with slight overlaps for dynamic feel
   * Best for: 4-9 products, catalog-style
   */
  GridWithOverlap: {
    name: 'GridWithOverlap',
    description: 'Grid layout with intentional overlaps',
    minItems: 4,
    maxItems: 9,
    allowOverlap: true,
    balanceRule: 'symmetry',
    defaultCanvasSize: { width: 1200, height: 1200 }
  },

  /**
   * Diagonal Cascade
   * Diagonal flow from top-left to bottom-right
   * Best for: 3-6 products, dynamic movement
   */
  DiagonalCascade: {
    name: 'DiagonalCascade',
    description: 'Diagonal flow with cascading elements',
    minItems: 3,
    maxItems: 6,
    allowOverlap: true,
    balanceRule: 'dynamic',
    defaultCanvasSize: { width: 1200, height: 1600 }
  },

  /**
   * Symmetric Balance
   * Perfect symmetry around vertical axis
   * Best for: 4-8 products, formal compositions
   */
  SymmetricBalance: {
    name: 'SymmetricBalance',
    description: 'Perfectly balanced symmetric layout',
    minItems: 4,
    maxItems: 8,
    allowOverlap: false,
    balanceRule: 'symmetry',
    defaultCanvasSize: { width: 1200, height: 1200 }
  },

  /**
   * Asymmetric Flow
   * Intentionally unbalanced for visual interest
   * Best for: 3-7 products, editorial style
   */
  AsymmetricFlow: {
    name: 'AsymmetricFlow',
    description: 'Asymmetric composition with visual flow',
    minItems: 3,
    maxItems: 7,
    allowOverlap: true,
    balanceRule: 'negative-space',
    defaultCanvasSize: { width: 1200, height: 1600 }
  },

  /**
   * Collage Style
   * Organic, magazine-style collage
   * Best for: 5-10 products, casual/creative
   */
  CollageStyle: {
    name: 'CollageStyle',
    description: 'Organic collage with varied sizes and rotations',
    minItems: 5,
    maxItems: 10,
    allowOverlap: true,
    balanceRule: 'dynamic',
    defaultCanvasSize: { width: 1400, height: 1400 }
  }
};

/**
 * Get archetype by name
 */
export function getArchetype(name: LayoutArchetypeName): LayoutArchetype {
  return LAYOUT_ARCHETYPES[name];
}

/**
 * Get all available archetypes
 */
export function getAllArchetypes(): LayoutArchetype[] {
  return Object.values(LAYOUT_ARCHETYPES);
}

/**
 * Find suitable archetypes for a given number of products
 */
export function findArchetypesForProductCount(count: number): LayoutArchetype[] {
  return getAllArchetypes().filter(
    archetype => count >= archetype.minItems && count <= archetype.maxItems
  );
}

/**
 * Get recommended archetype for product count
 */
export function getRecommendedArchetype(count: number): LayoutArchetype {
  const suitable = findArchetypesForProductCount(count);

  if (suitable.length === 0) {
    // Default to most flexible archetype
    return LAYOUT_ARCHETYPES.CollageStyle;
  }

  // Prefer archetypes that are closer to their optimal range
  return suitable.reduce((best, current) => {
    const bestMid = (best.minItems + best.maxItems) / 2;
    const currentMid = (current.minItems + current.maxItems) / 2;
    const bestDiff = Math.abs(count - bestMid);
    const currentDiff = Math.abs(count - currentMid);

    return currentDiff < bestDiff ? current : best;
  });
}
