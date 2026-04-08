-- Migration: Add vibe_layer and pairs_with columns to enriched_products
-- Run this in Supabase SQL Editor after the initial table creation

-- Add vibe_layer column for lifestyle mood board categorization
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS vibe_layer TEXT;

-- Add pairs_with column for complementary category suggestions
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS pairs_with TEXT[];

-- Add image_url column for product image reference
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add source_url column for original product link
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Create index on vibe_layer for filtering by mood/vibe
CREATE INDEX IF NOT EXISTS idx_enriched_products_vibe_layer ON enriched_products(vibe_layer);

-- Create GIN index on pairs_with for searching complementary items
CREATE INDEX IF NOT EXISTS idx_enriched_products_pairs_with ON enriched_products USING GIN(pairs_with);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'vibe_layer, pairs_with, image_url, and source_url columns added successfully!';
END $$;
