/**
 * Product Enrichment Types
 * Moodlayer SDK - Day 1
 *
 * Extended for Task 9: Variant + Dimension Support
 */

/**
 * Product variant (color/size combination)
 */
export interface ProductVariant {
  id?: string;
  color?: string;
  size?: string;
  url: string;
  price?: number;
  sku?: string;
  image_url?: string;
}

/**
 * Physical product dimensions
 */
export interface ProductDimensions {
  width?: number;   // in cm
  height?: number;  // in cm
  depth?: number;   // in cm
  weight?: number;  // in kg
  weight_unit?: 'kg' | 'g' | 'lbs' | 'oz';
}

/**
 * Fit tags for layout placement
 * Used by layout engine to determine placement priority
 */
export type FitTag = 'bulky' | 'flat' | 'delicate' | 'lightweight' | 'oversized';

export interface RawProductInput {
  product_name: string;
  brand: string;
  category: string;
  price?: number;
  region?: string;
  dimensions?: string;  // Legacy string format (deprecated)

  // New: Variant support
  variants?: ProductVariant[];

  // New: Structured dimensions
  product_dimensions?: ProductDimensions;

  // New: Fit tags for layout
  fit_tags?: FitTag[];

  // External platform ID
  external_id?: string;
  platform?: 'shopify' | 'woocommerce' | 'wix' | 'csv';
}

export interface EnrichedProductFields {
  color_palette: string[];
  tags: string[];
  texture: string;
  material: string;
  tone: string;
  flags?: string[];
}

export interface EnrichedProduct extends RawProductInput, EnrichedProductFields {
  id?: string;
  enriched_at?: string;
  created_at?: string;
  updated_at?: string;

  // Canonical tags (normalized against taxonomy)
  canonical_tags?: string[];
}

export interface ClaudeEnrichmentResponse {
  color_palette: string[];
  tags: string[];
  texture: string;
  material: string;
  tone: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface EnrichmentConfig {
  anthropicApiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  model?: string;
}
