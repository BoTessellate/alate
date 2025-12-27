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
 * Layout archetype names
 */
export type LayoutArchetypeName =
  | 'ZigZagStaggered'
  | 'LayeredCenterpiece'
  | 'MinimalSplit'
  | 'GridWithOverlap'
  | 'DiagonalCascade'
  | 'SymmetricBalance'
  | 'AsymmetricFlow'
  | 'CollageStyle';

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
