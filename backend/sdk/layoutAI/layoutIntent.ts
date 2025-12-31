/**
 * Layout Intent Engine (v4)
 *
 * Calculates layout intent using the 4 simplified archetypes.
 * Vision AI analyzes products and recommends optimal placement.
 *
 * Archetypes:
 * - Minimal: Clean, whitespace-focused (2-4 products)
 * - Hero: Central focus with supporting items (3-6 products)
 * - Dynamic: Flowing, editorial style (3-8 products)
 * - Collage: Organic, overlapping (4-12 products)
 */

import {
  LayoutArchetypeName,
  Size,
  VisionLayoutHint,
  VisionLayoutAnalysis,
  BoundingBox
} from '../layoutGenerator/types';
import { ARCHETYPE_CHARACTERISTICS, resolveLegacyArchetype } from '../layoutGenerator/layoutArchetypes';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Layout style preferences
 */
export type LayoutStylePreference = 'default' | 'editorial' | 'minimal' | 'creative';

/**
 * Layout intent input from frontend
 */
export interface LayoutIntent {
  productCount: number;
  themeColor: string;
  layoutStyle: LayoutStylePreference;
  colorHarmony?: 'strong' | 'moderate' | 'weak';
  productImages?: string[]; // Base64 images for Vision AI analysis
}

/**
 * Archetype suggestion with metadata
 */
export interface ArchetypeSuggestion {
  archetype: LayoutArchetypeName;
  confidence: number; // 0-1
  reason: string;
  canvasSize: Size;
  rules: LayoutRules;
}

/**
 * Layout rules for visual balance enforcement
 */
export interface LayoutRules {
  allowOverlap: boolean;
  maxOverlapPercent: number; // 0-100
  minSpacing: number; // pixels
  preserveLabelVisibility: boolean;
  maintainVisualAnchor: boolean;
  preventProductOcclusion: boolean;
  balanceRule: 'symmetry' | 'whitespace' | 'negative-space' | 'dynamic';
  maxRotation: number;
  whitespaceRatio: number;
}

/**
 * Complete layout intent result
 */
export interface LayoutIntentResult {
  suggestions: ArchetypeSuggestion[];
  primarySuggestion: ArchetypeSuggestion;
  layoutGoal: string;
  visionAnalysis?: VisionLayoutAnalysis;
}

// =============================================================================
// ARCHETYPE CONFIGURATIONS
// =============================================================================

const ARCHETYPE_CONFIGS: Record<LayoutArchetypeName, Omit<ArchetypeSuggestion, 'confidence' | 'reason'>> = {
  Minimal: {
    archetype: 'Minimal',
    canvasSize: { width: 1200, height: 1600 },
    rules: {
      allowOverlap: false,
      maxOverlapPercent: 0,
      minSpacing: 80,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'whitespace',
      maxRotation: 0,
      whitespaceRatio: 0.5,
    },
  },
  Hero: {
    archetype: 'Hero',
    canvasSize: { width: 1200, height: 1200 },
    rules: {
      allowOverlap: true,
      maxOverlapPercent: 20,
      minSpacing: 24,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'symmetry',
      maxRotation: 5,
      whitespaceRatio: 0.3,
    },
  },
  Dynamic: {
    archetype: 'Dynamic',
    canvasSize: { width: 1200, height: 1600 },
    rules: {
      allowOverlap: true,
      maxOverlapPercent: 30,
      minSpacing: 16,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'dynamic',
      maxRotation: 12,
      whitespaceRatio: 0.25,
    },
  },
  Collage: {
    archetype: 'Collage',
    canvasSize: { width: 1400, height: 1400 },
    rules: {
      allowOverlap: true,
      maxOverlapPercent: 40,
      minSpacing: 8,
      preserveLabelVisibility: true,
      maintainVisualAnchor: false,
      preventProductOcclusion: true,
      balanceRule: 'dynamic',
      maxRotation: 15,
      whitespaceRatio: 0.15,
    },
  },
};

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Calculate layout intent and suggest archetypes
 *
 * @param intent - Layout intent from frontend
 * @returns Complete layout intent result with suggestions
 */
export function calculateLayoutIntent(intent: LayoutIntent): LayoutIntentResult {
  try {
    const { productCount, layoutStyle } = intent;

    // Get archetype suggestions based on product count and style
    const suggestions = getSuggestionsForProductCount(productCount, layoutStyle);

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    // Generate layout goal for vision AI
    const primarySuggestion = suggestions[0];
    const layoutGoal = generateLayoutGoal(primarySuggestion, intent);

    return {
      suggestions,
      primarySuggestion,
      layoutGoal,
    };
  } catch (error: any) {
    console.error('[calculateLayoutIntent] Failed:', error.message);
    return getDefaultLayoutIntent(intent);
  }
}

/**
 * Get archetype suggestions for a specific product count
 */
function getSuggestionsForProductCount(
  count: number,
  style: LayoutStylePreference
): ArchetypeSuggestion[] {
  const suggestions: ArchetypeSuggestion[] = [];

  // 2 products: Minimal is best
  if (count === 2) {
    suggestions.push(
      createArchetypeSuggestion('Minimal', 0.95, 'Optimal for 2 products with balanced whitespace'),
      createArchetypeSuggestion('Hero', 0.6, 'Alternative with hero emphasis')
    );
  }

  // 3-4 products: Minimal or Hero
  if (count >= 3 && count <= 4) {
    suggestions.push(
      createArchetypeSuggestion('Minimal', 0.85, 'Clean layout for small collection'),
      createArchetypeSuggestion('Hero', 0.9, 'Hero focus with supporting items'),
      createArchetypeSuggestion('Dynamic', 0.7, 'Editorial flow option')
    );
  }

  // 5-6 products: Hero or Dynamic
  if (count >= 5 && count <= 6) {
    suggestions.push(
      createArchetypeSuggestion('Hero', 0.9, 'Hero layout with supporting cast'),
      createArchetypeSuggestion('Dynamic', 0.85, 'Flowing editorial arrangement'),
      createArchetypeSuggestion('Collage', 0.7, 'Creative collage option')
    );
  }

  // 7-8 products: Dynamic or Collage
  if (count >= 7 && count <= 8) {
    suggestions.push(
      createArchetypeSuggestion('Dynamic', 0.9, 'Best for 7-8 products with movement'),
      createArchetypeSuggestion('Collage', 0.85, 'Organic magazine-style layout')
    );
  }

  // 9+ products: Collage is best
  if (count >= 9) {
    suggestions.push(
      createArchetypeSuggestion('Collage', 0.95, 'Best for many products with organic overlap'),
      createArchetypeSuggestion('Dynamic', 0.7, 'Alternative with more structure')
    );
  }

  // Apply style preference boost
  applyStyleBoost(suggestions, style);

  return suggestions;
}

/**
 * Apply style preference boost to suggestions
 */
function applyStyleBoost(
  suggestions: ArchetypeSuggestion[],
  style: LayoutStylePreference
): void {
  const styleArchetypes: Record<LayoutStylePreference, LayoutArchetypeName[]> = {
    default: [],
    minimal: ['Minimal'],
    editorial: ['Dynamic', 'Hero'],
    creative: ['Collage', 'Dynamic'],
  };

  const boostedTypes = styleArchetypes[style];
  suggestions.forEach((s) => {
    if (boostedTypes.includes(s.archetype)) {
      s.confidence = Math.min(1, s.confidence + 0.15);
      s.reason += ` (style preference: ${style})`;
    }
  });
}

/**
 * Create an archetype suggestion object
 */
function createArchetypeSuggestion(
  archetype: LayoutArchetypeName,
  confidence: number,
  reason: string
): ArchetypeSuggestion {
  const config = ARCHETYPE_CONFIGS[archetype];
  return {
    archetype,
    confidence,
    reason,
    canvasSize: config.canvasSize,
    rules: config.rules,
  };
}

/**
 * Generate layout goal text for vision AI
 */
function generateLayoutGoal(
  suggestion: ArchetypeSuggestion,
  intent: LayoutIntent
): string {
  const { rules, archetype } = suggestion;
  const parts: string[] = [];

  // Archetype-specific descriptions
  const archetypeDescriptions: Record<LayoutArchetypeName, string> = {
    Minimal: 'Clean, whitespace-focused composition with clear focal hierarchy',
    Hero: 'Central hero product with symmetrically balanced supporting items',
    Dynamic: 'Flowing editorial layout with visual rhythm and intentional asymmetry',
    Collage: 'Organic magazine-style collage with varied sizes and creative overlaps',
  };

  parts.push(`${archetype} layout: ${archetypeDescriptions[archetype]}`);
  parts.push(`for ${intent.productCount} products`);

  // Balance and overlap rules
  if (rules.allowOverlap) {
    parts.push(`allowing up to ${rules.maxOverlapPercent}% artistic overlap`);
  } else {
    parts.push('with clean separation between elements');
  }

  // Rotation guidance
  if (rules.maxRotation > 0) {
    parts.push(`rotation up to ${rules.maxRotation} degrees for dynamism`);
  }

  // Whitespace target
  parts.push(`targeting ${Math.round(rules.whitespaceRatio * 100)}% whitespace`);

  // Theme color hint
  if (intent.themeColor) {
    parts.push(`using ${intent.themeColor} as accent`);
  }

  return parts.join(', ');
}

/**
 * Get default layout intent for fallback
 */
function getDefaultLayoutIntent(intent: LayoutIntent): LayoutIntentResult {
  const archetype = intent.productCount <= 4 ? 'Minimal' :
                    intent.productCount <= 7 ? 'Dynamic' : 'Collage';

  const defaultSuggestion = createArchetypeSuggestion(
    archetype,
    0.5,
    'Default fallback layout'
  );

  return {
    suggestions: [defaultSuggestion],
    primarySuggestion: defaultSuggestion,
    layoutGoal: `Default ${archetype} layout for ${intent.productCount} products`,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get layout rules for a specific archetype
 */
export function getLayoutRules(archetype: LayoutArchetypeName): LayoutRules {
  return ARCHETYPE_CONFIGS[archetype]?.rules || ARCHETYPE_CONFIGS.Dynamic.rules;
}

/**
 * Get canvas size for a specific archetype
 */
export function getCanvasSize(archetype: LayoutArchetypeName): Size {
  return ARCHETYPE_CONFIGS[archetype]?.canvasSize || { width: 1200, height: 1200 };
}

/**
 * Validate layout intent input
 */
export function validateLayoutIntent(intent: Partial<LayoutIntent>): LayoutIntent {
  return {
    productCount: Math.max(2, Math.min(12, intent.productCount || 2)),
    themeColor: intent.themeColor || '#4c7031',
    layoutStyle: intent.layoutStyle || 'default',
    colorHarmony: intent.colorHarmony,
    productImages: intent.productImages,
  };
}

/**
 * Get all available archetype names
 */
export function getArchetypeNames(): LayoutArchetypeName[] {
  return Object.keys(ARCHETYPE_CONFIGS) as LayoutArchetypeName[];
}

/**
 * Resolve legacy archetype name to new simplified name
 * Re-export for convenience
 */
export { resolveLegacyArchetype };
