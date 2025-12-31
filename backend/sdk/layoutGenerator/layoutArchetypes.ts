/**
 * Layout Archetypes Library (v4)
 * Simplified to 4 core types - Vision AI selects and adapts
 */

import {
  LayoutArchetype,
  LayoutArchetypeName,
  LegacyArchetypeName,
  LEGACY_ARCHETYPE_MAP
} from './types';

/**
 * Library of layout archetypes - 4 core types
 * Vision AI dynamically adjusts placement within these frameworks
 */
export const LAYOUT_ARCHETYPES: Record<LayoutArchetypeName, LayoutArchetype> = {
  /**
   * Minimal
   * Clean, whitespace-focused compositions
   * Best for: 2-4 products, editorial/luxury aesthetic
   * Vision AI focuses on: negative space balance, focal hierarchy
   */
  Minimal: {
    name: 'Minimal',
    description: 'Clean compositions with generous whitespace and clear focal points',
    minItems: 2,
    maxItems: 4,
    allowOverlap: false,
    balanceRule: 'whitespace',
    defaultCanvasSize: { width: 1200, height: 1600 }
  },

  /**
   * Hero
   * Central focus with supporting elements
   * Best for: 3-6 products, product spotlight
   * Vision AI focuses on: identifying hero product, supporting hierarchy
   */
  Hero: {
    name: 'Hero',
    description: 'Central hero image with layered supporting products',
    minItems: 3,
    maxItems: 6,
    allowOverlap: true,
    balanceRule: 'symmetry',
    defaultCanvasSize: { width: 1200, height: 1200 }
  },

  /**
   * Dynamic
   * Flowing, editorial-style compositions
   * Best for: 3-8 products, storytelling/fashion
   * Vision AI focuses on: visual flow, rhythm, movement
   */
  Dynamic: {
    name: 'Dynamic',
    description: 'Flowing editorial layout with visual rhythm and movement',
    minItems: 3,
    maxItems: 8,
    allowOverlap: true,
    balanceRule: 'dynamic',
    defaultCanvasSize: { width: 1200, height: 1600 }
  },

  /**
   * Collage
   * Organic, magazine-style compositions
   * Best for: 4-12 products, mood/lifestyle
   * Vision AI focuses on: organic grouping, color harmony, texture mixing
   */
  Collage: {
    name: 'Collage',
    description: 'Organic collage with varied sizes, rotations, and overlaps',
    minItems: 4,
    maxItems: 12,
    allowOverlap: true,
    balanceRule: 'dynamic',
    defaultCanvasSize: { width: 1400, height: 1400 }
  }
};

/**
 * Human-friendly display names for archetypes
 */
export const ARCHETYPE_DISPLAY_NAMES: Record<LayoutArchetypeName, string> = {
  Minimal: 'Minimal',
  Hero: 'Hero Focus',
  Dynamic: 'Dynamic Flow',
  Collage: 'Collage'
};

/**
 * Archetype characteristics for Vision AI decision making
 */
export const ARCHETYPE_CHARACTERISTICS = {
  Minimal: {
    whitespaceRatio: 0.5,      // Target 50%+ whitespace
    maxRotation: 0,            // No rotation
    overlapAllowed: false,
    scalingRange: [0.3, 0.6],  // Smaller, more uniform sizes
    focusStyle: 'distributed'  // Even visual weight
  },
  Hero: {
    whitespaceRatio: 0.3,
    maxRotation: 5,
    overlapAllowed: true,
    scalingRange: [0.2, 0.8],  // Wide range for hero emphasis
    focusStyle: 'central'      // Central focal point
  },
  Dynamic: {
    whitespaceRatio: 0.25,
    maxRotation: 12,
    overlapAllowed: true,
    scalingRange: [0.25, 0.7],
    focusStyle: 'flowing'      // Visual path through composition
  },
  Collage: {
    whitespaceRatio: 0.15,
    maxRotation: 15,
    overlapAllowed: true,
    scalingRange: [0.2, 0.6],
    focusStyle: 'organic'      // Natural, scattered grouping
  }
};

/**
 * Resolve legacy archetype name to new simplified name
 */
export function resolveLegacyArchetype(name: string): LayoutArchetypeName {
  // Check if it's already a new archetype name
  if (name in LAYOUT_ARCHETYPES) {
    return name as LayoutArchetypeName;
  }

  // Map legacy name to new
  if (name in LEGACY_ARCHETYPE_MAP) {
    return LEGACY_ARCHETYPE_MAP[name as LegacyArchetypeName];
  }

  // Default fallback
  return 'Dynamic';
}

/**
 * Get archetype by name (supports legacy names)
 */
export function getArchetype(name: string): LayoutArchetype {
  const resolvedName = resolveLegacyArchetype(name);
  return LAYOUT_ARCHETYPES[resolvedName];
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
 * Vision AI should override this with analysis-based recommendation
 */
export function getRecommendedArchetype(count: number): LayoutArchetype {
  const suitable = findArchetypesForProductCount(count);

  if (suitable.length === 0) {
    // Default to most flexible archetype
    return LAYOUT_ARCHETYPES.Collage;
  }

  // Product count based recommendations
  if (count <= 3) return LAYOUT_ARCHETYPES.Minimal;
  if (count <= 5) return LAYOUT_ARCHETYPES.Hero;
  if (count <= 7) return LAYOUT_ARCHETYPES.Dynamic;
  return LAYOUT_ARCHETYPES.Collage;
}

/**
 * Get display name for archetype
 */
export function getArchetypeDisplayName(name: LayoutArchetypeName): string {
  return ARCHETYPE_DISPLAY_NAMES[name] || name;
}

/**
 * Get archetype by display name
 */
export function getArchetypeByDisplayName(displayName: string): LayoutArchetype | undefined {
  const entry = Object.entries(ARCHETYPE_DISPLAY_NAMES).find(
    ([_, display]) => display === displayName
  );
  if (entry) {
    return LAYOUT_ARCHETYPES[entry[0] as LayoutArchetypeName];
  }
  return undefined;
}

/**
 * Get all archetype names in order for remixing
 */
export function getArchetypeNamesInOrder(): LayoutArchetypeName[] {
  return Object.keys(LAYOUT_ARCHETYPES) as LayoutArchetypeName[];
}

/**
 * Get next archetype in cycle (for remix)
 */
export function getNextArchetype(
  current: LayoutArchetypeName,
  productCount?: number
): LayoutArchetype {
  const allNames = getArchetypeNamesInOrder();

  let compatibleNames = allNames;
  if (productCount !== undefined) {
    compatibleNames = allNames.filter(name => {
      const arch = LAYOUT_ARCHETYPES[name];
      return productCount >= arch.minItems && productCount <= arch.maxItems;
    });

    if (compatibleNames.length === 0) {
      compatibleNames = allNames;
    }
  }

  const currentIndex = compatibleNames.indexOf(current);
  const nextIndex = (currentIndex + 1) % compatibleNames.length;

  return LAYOUT_ARCHETYPES[compatibleNames[nextIndex]];
}

/**
 * Get previous archetype in cycle (for remix backward)
 */
export function getPreviousArchetype(
  current: LayoutArchetypeName,
  productCount?: number
): LayoutArchetype {
  const allNames = getArchetypeNamesInOrder();

  let compatibleNames = allNames;
  if (productCount !== undefined) {
    compatibleNames = allNames.filter(name => {
      const arch = LAYOUT_ARCHETYPES[name];
      return productCount >= arch.minItems && productCount <= arch.maxItems;
    });

    if (compatibleNames.length === 0) {
      compatibleNames = allNames;
    }
  }

  const currentIndex = compatibleNames.indexOf(current);
  const prevIndex = currentIndex <= 0 ? compatibleNames.length - 1 : currentIndex - 1;

  return LAYOUT_ARCHETYPES[compatibleNames[prevIndex]];
}

/**
 * Get random archetype (for shuffle remix)
 */
export function getRandomArchetype(
  exclude?: LayoutArchetypeName,
  productCount?: number
): LayoutArchetype {
  let candidates = getAllArchetypes();

  if (productCount !== undefined) {
    const filtered = candidates.filter(
      arch => productCount >= arch.minItems && productCount <= arch.maxItems
    );
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  if (exclude) {
    candidates = candidates.filter(arch => arch.name !== exclude);
  }

  if (candidates.length === 0) {
    return LAYOUT_ARCHETYPES.Collage;
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}
