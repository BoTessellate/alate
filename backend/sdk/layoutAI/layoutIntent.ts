/**
 * Layout Intent Engine
 *
 * Calculates layout rules from product count and style preferences.
 * Suggests archetypes and passes layout goals to vision engines.
 *
 * Features:
 * - Quantity-aware layout selection
 * - Fadeback Hero collage support
 * - Visual balance enforcement rules
 */

import { LayoutArchetypeName, Size } from '../layoutGenerator/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Layout style options
 */
export type LayoutStylePreference = 'default' | 'magazine' | 'fadebackHero';

/**
 * Extended archetype names including new styles
 */
export type ExtendedArchetypeName =
  | LayoutArchetypeName
  | 'FadebackHero'
  | 'CenteredDuo'
  | 'LooseGrid'
  | 'RightCascade';

/**
 * Layout intent input from frontend
 */
export interface LayoutIntent {
  productCount: number;
  themeColor: string;
  layoutStyle: LayoutStylePreference;
  colorHarmony?: 'strong' | 'moderate' | 'weak';
}

/**
 * Archetype suggestion with metadata
 */
export interface ArchetypeSuggestion {
  archetype: ExtendedArchetypeName;
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
}

/**
 * Fadeback Hero configuration
 */
export interface FadebackHeroConfig {
  enabled: boolean;
  backgroundOpacity: number; // 0.65-0.80
  tintColor: string;
  blendMode: 'overlay' | 'soft-light' | 'multiply';
}

/**
 * Complete layout intent result
 */
export interface LayoutIntentResult {
  suggestions: ArchetypeSuggestion[];
  primarySuggestion: ArchetypeSuggestion;
  fadebackHero?: FadebackHeroConfig;
  layoutGoal: string; // Text description for vision AI
}

// =============================================================================
// ARCHETYPE CONFIGURATIONS
// =============================================================================

const ARCHETYPE_CONFIGS: Record<ExtendedArchetypeName, Omit<ArchetypeSuggestion, 'confidence' | 'reason'>> = {
  // Existing archetypes
  ZigZagStaggered: {
    archetype: 'ZigZagStaggered',
    canvasSize: { width: 1200, height: 1600 },
    rules: {
      allowOverlap: false,
      maxOverlapPercent: 0,
      minSpacing: 24,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'dynamic',
    },
  },
  LayeredCenterpiece: {
    archetype: 'LayeredCenterpiece',
    canvasSize: { width: 1200, height: 1200 },
    rules: {
      allowOverlap: true,
      maxOverlapPercent: 25,
      minSpacing: 16,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'symmetry',
    },
  },
  MinimalSplit: {
    archetype: 'MinimalSplit',
    canvasSize: { width: 1200, height: 1600 },
    rules: {
      allowOverlap: false,
      maxOverlapPercent: 0,
      minSpacing: 40,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'whitespace',
    },
  },
  GridWithOverlap: {
    archetype: 'GridWithOverlap',
    canvasSize: { width: 1200, height: 1200 },
    rules: {
      allowOverlap: true,
      maxOverlapPercent: 20,
      minSpacing: 12,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'symmetry',
    },
  },
  DiagonalCascade: {
    archetype: 'DiagonalCascade',
    canvasSize: { width: 1200, height: 1600 },
    rules: {
      allowOverlap: true,
      maxOverlapPercent: 30,
      minSpacing: 16,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'dynamic',
    },
  },
  SymmetricBalance: {
    archetype: 'SymmetricBalance',
    canvasSize: { width: 1200, height: 1200 },
    rules: {
      allowOverlap: false,
      maxOverlapPercent: 0,
      minSpacing: 32,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'symmetry',
    },
  },
  AsymmetricFlow: {
    archetype: 'AsymmetricFlow',
    canvasSize: { width: 1200, height: 1600 },
    rules: {
      allowOverlap: true,
      maxOverlapPercent: 25,
      minSpacing: 20,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'negative-space',
    },
  },
  CollageStyle: {
    archetype: 'CollageStyle',
    canvasSize: { width: 1400, height: 1400 },
    rules: {
      allowOverlap: true,
      maxOverlapPercent: 35,
      minSpacing: 8,
      preserveLabelVisibility: true,
      maintainVisualAnchor: false,
      preventProductOcclusion: true,
      balanceRule: 'dynamic',
    },
  },

  // New archetypes from Task 3
  FadebackHero: {
    archetype: 'FadebackHero',
    canvasSize: { width: 1200, height: 1600 },
    rules: {
      allowOverlap: true,
      maxOverlapPercent: 40,
      minSpacing: 16,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: false, // Background can be behind products
      balanceRule: 'dynamic',
    },
  },
  CenteredDuo: {
    archetype: 'CenteredDuo',
    canvasSize: { width: 1200, height: 1200 },
    rules: {
      allowOverlap: false,
      maxOverlapPercent: 0,
      minSpacing: 48,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'symmetry',
    },
  },
  LooseGrid: {
    archetype: 'LooseGrid',
    canvasSize: { width: 1400, height: 1400 },
    rules: {
      allowOverlap: false,
      maxOverlapPercent: 10,
      minSpacing: 24,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'whitespace',
    },
  },
  RightCascade: {
    archetype: 'RightCascade',
    canvasSize: { width: 1200, height: 1600 },
    rules: {
      allowOverlap: true,
      maxOverlapPercent: 30,
      minSpacing: 16,
      preserveLabelVisibility: true,
      maintainVisualAnchor: true,
      preventProductOcclusion: true,
      balanceRule: 'negative-space',
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
    const { productCount, themeColor, layoutStyle, colorHarmony } = intent;

    // Get archetype suggestions based on product count
    const suggestions = getSuggestionsForProductCount(productCount, layoutStyle);

    // Check if Fadeback Hero should be enabled
    const fadebackHero = shouldEnableFadebackHero(productCount, layoutStyle, colorHarmony)
      ? createFadebackHeroConfig(themeColor)
      : undefined;

    // If Fadeback Hero is enabled, prioritize it
    if (fadebackHero) {
      const heroSuggestion = createArchetypeSuggestion('FadebackHero', 0.95, 'Strong color harmony with 3+ products');
      suggestions.unshift(heroSuggestion);
    }

    // Generate layout goal for vision AI
    const primarySuggestion = suggestions[0];
    const layoutGoal = generateLayoutGoal(primarySuggestion, intent);

    return {
      suggestions,
      primarySuggestion,
      fadebackHero,
      layoutGoal,
    };
  } catch (error: any) {
    console.error('[calculateLayoutIntent] Failed:', error.message);
    // Return safe default
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

  // 1-2 products: Centered with text balancing
  if (count >= 1 && count <= 2) {
    suggestions.push(
      createArchetypeSuggestion('CenteredDuo', 0.9, 'Optimal for 1-2 products with balanced text'),
      createArchetypeSuggestion('MinimalSplit', 0.8, 'Clean split with whitespace'),
      createArchetypeSuggestion('LayeredCenterpiece', 0.6, 'Hero focus option')
    );
  }

  // 3-5 products: Loose grid, faded hero, layered
  if (count >= 3 && count <= 5) {
    if (style === 'fadebackHero') {
      suggestions.push(createArchetypeSuggestion('FadebackHero', 0.95, 'Requested fadeback hero style'));
    }
    suggestions.push(
      createArchetypeSuggestion('LooseGrid', 0.85, 'Flexible grid for 3-5 products'),
      createArchetypeSuggestion('LayeredCenterpiece', 0.8, 'Layered with hero product'),
      createArchetypeSuggestion('DiagonalCascade', 0.75, 'Dynamic diagonal flow'),
      createArchetypeSuggestion('AsymmetricFlow', 0.7, 'Editorial asymmetric style')
    );
  }

  // 6+ products: Overlap + symmetry or right-heavy cascade
  if (count >= 6) {
    suggestions.push(
      createArchetypeSuggestion('GridWithOverlap', 0.9, 'Grid with intentional overlaps for 6+ products'),
      createArchetypeSuggestion('RightCascade', 0.85, 'Right-heavy cascade for many products'),
      createArchetypeSuggestion('SymmetricBalance', 0.8, 'Balanced symmetric layout'),
      createArchetypeSuggestion('CollageStyle', 0.75, 'Organic collage for many items')
    );
  }

  // Apply style preference boost
  if (style === 'magazine') {
    const magazineStyles: ExtendedArchetypeName[] = ['AsymmetricFlow', 'DiagonalCascade', 'CollageStyle'];
    suggestions.forEach((s) => {
      if (magazineStyles.includes(s.archetype)) {
        s.confidence = Math.min(1, s.confidence + 0.1);
      }
    });
  }

  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
}

/**
 * Create an archetype suggestion object
 */
function createArchetypeSuggestion(
  archetype: ExtendedArchetypeName,
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
 * Check if Fadeback Hero should be enabled
 */
function shouldEnableFadebackHero(
  productCount: number,
  style: LayoutStylePreference,
  colorHarmony?: 'strong' | 'moderate' | 'weak'
): boolean {
  // Explicit style request
  if (style === 'fadebackHero') return true;

  // Auto-enable for 3+ products with strong color harmony
  if (productCount >= 3 && colorHarmony === 'strong') return true;

  return false;
}

/**
 * Create Fadeback Hero configuration
 */
function createFadebackHeroConfig(themeColor: string): FadebackHeroConfig {
  return {
    enabled: true,
    backgroundOpacity: 0.72, // Middle of 0.65-0.80 range
    tintColor: themeColor,
    blendMode: 'soft-light',
  };
}

/**
 * Generate layout goal text for vision AI
 */
function generateLayoutGoal(
  suggestion: ArchetypeSuggestion,
  intent: LayoutIntent
): string {
  const { rules } = suggestion;
  const parts: string[] = [];

  // Base style description
  parts.push(`${suggestion.archetype} layout for ${intent.productCount} products`);

  // Balance rule
  parts.push(`with ${rules.balanceRule} balance`);

  // Overlap handling
  if (rules.allowOverlap) {
    parts.push(`allowing up to ${rules.maxOverlapPercent}% artistic overlap`);
  } else {
    parts.push('with no overlaps');
  }

  // Visual constraints
  const constraints: string[] = [];
  if (rules.preserveLabelVisibility) constraints.push('preserve label visibility');
  if (rules.maintainVisualAnchor) constraints.push('maintain visual anchor');
  if (rules.preventProductOcclusion) constraints.push('prevent product occlusion');

  if (constraints.length > 0) {
    parts.push(`- ${constraints.join(', ')}`);
  }

  // Theme color hint
  if (intent.themeColor) {
    parts.push(`using ${intent.themeColor} as theme accent`);
  }

  return parts.join(', ');
}

/**
 * Get default layout intent for fallback
 */
function getDefaultLayoutIntent(intent: LayoutIntent): LayoutIntentResult {
  const defaultSuggestion = createArchetypeSuggestion(
    'LooseGrid',
    0.5,
    'Default fallback layout'
  );

  return {
    suggestions: [defaultSuggestion],
    primarySuggestion: defaultSuggestion,
    layoutGoal: `Default layout for ${intent.productCount} products with balanced spacing`,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get layout rules for a specific archetype
 */
export function getLayoutRules(archetype: ExtendedArchetypeName): LayoutRules {
  return ARCHETYPE_CONFIGS[archetype]?.rules || ARCHETYPE_CONFIGS.LooseGrid.rules;
}

/**
 * Get canvas size for a specific archetype
 */
export function getCanvasSize(archetype: ExtendedArchetypeName): Size {
  return ARCHETYPE_CONFIGS[archetype]?.canvasSize || { width: 1200, height: 1200 };
}

/**
 * Check if an archetype supports Fadeback Hero
 */
export function supportsFadebackHero(archetype: ExtendedArchetypeName): boolean {
  const supportedTypes: ExtendedArchetypeName[] = [
    'FadebackHero',
    'LayeredCenterpiece',
    'CollageStyle',
    'AsymmetricFlow',
  ];
  return supportedTypes.includes(archetype);
}

/**
 * Validate layout intent input
 */
export function validateLayoutIntent(intent: Partial<LayoutIntent>): LayoutIntent {
  return {
    productCount: Math.max(1, Math.min(20, intent.productCount || 1)),
    themeColor: intent.themeColor || '#2C2416',
    layoutStyle: intent.layoutStyle || 'default',
    colorHarmony: intent.colorHarmony,
  };
}

/**
 * Get all available extended archetype names
 */
export function getExtendedArchetypeNames(): ExtendedArchetypeName[] {
  return Object.keys(ARCHETYPE_CONFIGS) as ExtendedArchetypeName[];
}
