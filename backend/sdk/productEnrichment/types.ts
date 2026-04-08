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

  // Product description and metadata for richer enrichment
  description?: string;       // Product description text
  meta_title?: string;        // SEO meta title
  meta_description?: string;  // SEO meta description
  product_type?: string;      // Shopify product type

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
  texture: string;       // Surface finish: smooth, matte, glossy, shiny, brushed, etc.
  weave?: string;        // Fabric construction: oxford, twill, sateen, jersey, flannel, etc.
  material: string;
  tone: string;
  flags?: string[];  // e.g., ["fragile", "handmade", "limited-edition", "eco-friendly"]
  fit_tags?: FitTag[];  // For layout placement: bulky, flat, delicate, etc.
  product_dimensions?: ProductDimensions;  // Parsed/inferred dimensions
}

export interface EnrichedProduct extends RawProductInput, EnrichedProductFields {
  id?: string;
  enriched_at?: string;
  created_at?: string;
  updated_at?: string;

  // Canonical tags (normalized against taxonomy)
  canonical_tags?: string[];

  // Image URL for the product (used for display and vision analysis)
  image_url?: string;

  // Vision analysis data (populated by GPT-4V or Gemini)
  vision_analysis?: VisionAnalysisResult;
}

/**
 * Vision analysis result from GPT-4V or Gemini
 * This is populated separately from text enrichment
 */
export interface VisionAnalysisResult {
  analyzed_at?: string;
  model_used?: 'gpt-4-vision' | 'gemini-pro-vision' | 'gemini-1.5-flash';
  dominant_colors?: string[];  // Colors detected in the actual image
  detected_objects?: string[];  // Objects/items visible in the image
  style_attributes?: string[];  // Visual style: modern, vintage, rustic, etc.
  quality_score?: number;  // Image quality 0-100
  background_type?: 'white' | 'lifestyle' | 'studio' | 'outdoor' | 'transparent';
  composition_notes?: string;  // Brief description of image composition
}

export interface ClaudeEnrichmentResponse {
  color_palette: string[];
  tags: string[];
  texture: string;       // Surface finish
  weave?: string;        // Fabric construction (for textiles)
  material: string;
  tone: string;
  flags?: string[];
  fit_tags?: FitTag[];
  inferred_dimensions?: {
    width_cm?: number;
    height_cm?: number;
    depth_cm?: number;
    size_category?: 'small' | 'medium' | 'large' | 'oversized';
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface EnrichmentConfig {
  anthropicApiKey?: string;  // Optional - Claude primary provider
  geminiApiKey?: string;     // Optional - Gemini fallback provider
  supabaseUrl: string;
  supabaseKey: string;
  model?: string;            // Claude model (default: claude-opus-4-5-20251101)
  geminiModel?: string;      // Gemini model (default: gemini-2.5-flash)
  useMorphicPrompts?: boolean; // Enable morphic prompts (default: true)
}
