/**
 * Layout Generator Types
 * Type definitions for moodboard layout generation
 */

/**
 * Position on canvas (x, y coordinates)
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Size dimensions (width, height)
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Bounding box for layout elements
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Fit tags for layout placement priority
 * Imported from productEnrichment types
 */
export type FitTag = 'bulky' | 'flat' | 'delicate' | 'lightweight' | 'oversized';

/**
 * Product variant for layout
 */
export interface ProductVariant {
  id?: string;
  color?: string;
  size?: string;
  url: string;
  image_url?: string;
}

/**
 * Physical dimensions for layout consideration
 */
export interface ProductDimensions {
  width?: number;
  height?: number;
  depth?: number;
}

/**
 * Product input for layout generation
 */
export interface ProductInput {
  image_url: string;
  brand: string;
  tags?: string[];
  product_name?: string;
  price?: number;

  // Variant support - used to display variant options
  variants?: ProductVariant[];

  // Dimensions affect layout placement
  dimensions?: ProductDimensions;

  // Fit tags determine placement priority
  fit_tags?: FitTag[];
}

/**
 * Layout element types
 */
export type ElementType = 'image' | 'text' | 'label' | 'price';

/**
 * Text style variants
 */
export type TextStyle = 'label' | 'caption' | 'price' | 'heading';

/**
 * Layout element in the composition
 */
export interface LayoutElement {
  type: ElementType;
  id?: string;               // Unique identifier for element
  src?: string;              // For images
  text?: string;             // For text/labels
  position: Position;
  size?: Size;               // Optional for text
  style?: TextStyle;
  rotation?: number;         // Optional rotation in degrees
  opacity?: number;          // Optional opacity 0-1
  zIndex?: number;           // Layer order
}

/**
 * Layout archetype names - Simplified to 4 core types
 * Vision AI selects and adapts these based on product analysis
 */
export type LayoutArchetypeName =
  | 'Minimal'      // Clean, whitespace-focused (2-4 products)
  | 'Hero'         // Central focus with supporting items (3-6 products)
  | 'Dynamic'      // Flowing, editorial style (3-8 products)
  | 'Collage';     // Organic, overlapping (4-12 products)

/**
 * Legacy archetype names - for backward compatibility
 * Maps to new simplified archetypes
 */
export type LegacyArchetypeName =
  | 'ZigZagStaggered'      // → Dynamic
  | 'LayeredCenterpiece'   // → Hero
  | 'MinimalSplit'         // → Minimal
  | 'GridWithOverlap'      // → Collage
  | 'DiagonalCascade'      // → Dynamic
  | 'SymmetricBalance'     // → Minimal
  | 'AsymmetricFlow'       // → Dynamic
  | 'CollageStyle';        // → Collage

/**
 * Map legacy archetype names to new ones
 */
export const LEGACY_ARCHETYPE_MAP: Record<LegacyArchetypeName, LayoutArchetypeName> = {
  ZigZagStaggered: 'Dynamic',
  LayeredCenterpiece: 'Hero',
  MinimalSplit: 'Minimal',
  GridWithOverlap: 'Collage',
  DiagonalCascade: 'Dynamic',
  SymmetricBalance: 'Minimal',
  AsymmetricFlow: 'Dynamic',
  CollageStyle: 'Collage',
};

/**
 * Vision AI layout hints - guides AI-driven placement decisions
 */
export interface VisionLayoutHint {
  /** Product visual weight (0-1) based on size, color intensity */
  visualWeight: number;
  /** Recommended placement zone (0=top-left, 1=center, 2=bottom-right) */
  placementZone: number;
  /** Suggested scale factor (0.5-1.5) */
  scaleFactor: number;
  /** Whether product should be a focal point */
  isFocalPoint: boolean;
  /** Suggested rotation for dynamic feel (-15 to 15 degrees) */
  suggestedRotation: number;
}

/**
 * Vision AI analysis result for layout optimization
 */
export interface VisionLayoutAnalysis {
  /** Overall composition score (0-100) */
  aestheticScore: number;
  /** Per-product placement hints */
  productHints: Map<string, VisionLayoutHint>;
  /** Recommended archetype based on product analysis */
  recommendedArchetype: LayoutArchetypeName;
  /** Suggested canvas aspect ratio */
  suggestedAspectRatio: number;
  /** Areas to avoid (brand logos, text) */
  avoidanceZones: BoundingBox[];
}

/**
 * Layout archetype definition
 */
export interface LayoutArchetype {
  name: LayoutArchetypeName;
  description: string;
  minItems: number;
  maxItems: number;
  allowOverlap: boolean;
  balanceRule: 'symmetry' | 'whitespace' | 'negative-space' | 'dynamic';
  defaultCanvasSize: Size;
}

/**
 * Layout generation input
 */
export interface LayoutInput {
  products: ProductInput[];
  layout_type: LayoutArchetypeName;
  canvas_size?: Size;        // Optional, defaults from archetype
  show_labels?: boolean;     // Show brand labels (default: true)
  show_prices?: boolean;     // Show prices (default: false)
}

/**
 * Generated layout output
 */
export interface LayoutOutput {
  layout_type: LayoutArchetypeName;
  canvas_size: Size;
  elements: LayoutElement[];
  metadata?: {
    generated_at: string;
    product_count: number;
    archetype_description: string;
  };
}

/**
 * Layout generation configuration
 */
export interface LayoutConfig {
  padding: number;           // Canvas padding
  minImageSize: number;      // Minimum image dimension
  maxImageSize: number;      // Maximum image dimension
  labelOffset: number;       // Distance from image to label
  allowRotation: boolean;    // Allow element rotation
  maxRotation: number;       // Max rotation in degrees
}
