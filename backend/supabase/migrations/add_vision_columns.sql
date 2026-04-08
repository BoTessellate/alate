-- Migration: Add Vision AI Columns to enriched_products
-- Run this in Supabase SQL Editor to add vision enrichment support
-- Date: 2025-12-27

-- Vision-extracted colors (JSON array with hex, name, percentage)
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS vision_colors JSONB DEFAULT '[]'::jsonb;

-- Vision-extracted textures
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS vision_textures TEXT[] DEFAULT '{}';

-- Vision-extracted patterns
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS vision_patterns TEXT[] DEFAULT '{}';

-- Vision-extracted materials
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS vision_materials TEXT[] DEFAULT '{}';

-- Vision-extracted style tags
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS vision_style_tags TEXT[] DEFAULT '{}';

-- Vision model confidence score (0-1)
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS vision_confidence DECIMAL(3,2);

-- Timestamp when vision analysis was performed
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS vision_analyzed_at TIMESTAMPTZ;

-- Vision embedding reference ID (for Pinecone)
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS vision_embedding_id TEXT;

-- AI-predicted tags
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS predicted_tags TEXT[] DEFAULT '{}';

-- Cached related product IDs
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS related_product_ids TEXT[] DEFAULT '{}';

-- Create GIN indexes for efficient array searches
CREATE INDEX IF NOT EXISTS idx_enriched_products_vision_colors ON enriched_products USING GIN (vision_colors);
CREATE INDEX IF NOT EXISTS idx_enriched_products_vision_textures ON enriched_products USING GIN (vision_textures);
CREATE INDEX IF NOT EXISTS idx_enriched_products_vision_patterns ON enriched_products USING GIN (vision_patterns);
CREATE INDEX IF NOT EXISTS idx_enriched_products_vision_materials ON enriched_products USING GIN (vision_materials);
CREATE INDEX IF NOT EXISTS idx_enriched_products_vision_style_tags ON enriched_products USING GIN (vision_style_tags);
CREATE INDEX IF NOT EXISTS idx_enriched_products_predicted_tags ON enriched_products USING GIN (predicted_tags);
CREATE INDEX IF NOT EXISTS idx_enriched_products_vision_analyzed ON enriched_products(vision_analyzed_at) WHERE vision_analyzed_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN enriched_products.vision_colors IS 'Vision AI extracted colors: [{hex, name, percentage}]';
COMMENT ON COLUMN enriched_products.vision_textures IS 'Vision AI detected textures: smooth, rough, woven, etc.';
COMMENT ON COLUMN enriched_products.vision_patterns IS 'Vision AI detected patterns: striped, floral, geometric, etc.';
COMMENT ON COLUMN enriched_products.vision_materials IS 'Vision AI detected materials: leather, wood, metal, etc.';
COMMENT ON COLUMN enriched_products.vision_style_tags IS 'Vision AI style tags: modern, vintage, bohemian, etc.';
COMMENT ON COLUMN enriched_products.vision_confidence IS 'Vision model confidence (0.00-1.00)';
COMMENT ON COLUMN enriched_products.vision_analyzed_at IS 'Last vision analysis timestamp';
COMMENT ON COLUMN enriched_products.vision_embedding_id IS 'Pinecone vector ID for visual similarity';
COMMENT ON COLUMN enriched_products.predicted_tags IS 'AI-predicted tags beyond user-provided';
COMMENT ON COLUMN enriched_products.related_product_ids IS 'Cached related product IDs';
