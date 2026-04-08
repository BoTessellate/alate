-- Migration: Add vision analysis, dimensions, and fit_tags columns
-- Run this in Supabase SQL Editor to update the enriched_products table
-- Created: 2024-12-20

-- Add image_url column if not exists
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add currency column for price
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add product_dimensions as JSONB for structured dimensions
-- Stores: { width: number, height: number, depth: number, weight: number, weight_unit: string }
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS product_dimensions JSONB;

-- Add fit_tags array for layout placement hints
-- Values: 'bulky', 'flat', 'delicate', 'lightweight', 'oversized'
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS fit_tags TEXT[];

-- Add canonical_tags array for taxonomy-normalized tags
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS canonical_tags TEXT[];

-- Add vision_analysis as JSONB for GPT-4V/Gemini analysis results
-- Stores: { analyzed_at, model_used, dominant_colors, detected_objects, style_attributes, quality_score, background_type, composition_notes }
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS vision_analysis JSONB;

-- Add variants as JSONB array for product variants
-- Stores: [{ id, color, size, url, price, sku, image_url }]
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS variants JSONB;

-- Add external platform fields
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Create index on fit_tags for layout queries
CREATE INDEX IF NOT EXISTS idx_enriched_products_fit_tags
ON enriched_products USING GIN(fit_tags);

-- Create index on canonical_tags for normalized search
CREATE INDEX IF NOT EXISTS idx_enriched_products_canonical_tags
ON enriched_products USING GIN(canonical_tags);

-- Create index on image_url for products with images
CREATE INDEX IF NOT EXISTS idx_enriched_products_image_url
ON enriched_products(image_url) WHERE image_url IS NOT NULL;

-- Create index for vision analysis status (products that have been analyzed)
CREATE INDEX IF NOT EXISTS idx_enriched_products_vision_analyzed
ON enriched_products((vision_analysis IS NOT NULL));

-- Add comment explaining the vision_analysis structure
COMMENT ON COLUMN enriched_products.vision_analysis IS
'Vision analysis from GPT-4V or Gemini. Structure: {
  analyzed_at: timestamp,
  model_used: "gpt-4-vision" | "gemini-pro-vision" | "gemini-1.5-flash",
  dominant_colors: string[],
  detected_objects: string[],
  style_attributes: string[],
  quality_score: number (0-100),
  background_type: "white" | "lifestyle" | "studio" | "outdoor" | "transparent",
  composition_notes: string
}';

COMMENT ON COLUMN enriched_products.product_dimensions IS
'Structured product dimensions. Structure: {
  width: number (cm),
  height: number (cm),
  depth: number (cm),
  weight: number,
  weight_unit: "kg" | "g" | "lbs" | "oz"
}';

COMMENT ON COLUMN enriched_products.fit_tags IS
'Layout placement hints: bulky, flat, delicate, lightweight, oversized';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 001_add_vision_and_dimensions completed successfully!';
END $$;
