-- Migration: Add cutout_url column to enriched_products table
-- Run this in Supabase SQL Editor to enable background removal caching
--
-- STATUS: READY TO APPLY
-- Apply: Run in Supabase SQL Editor or via CLI

-- Add cutout_url column to store pre-processed product images (background removed)
ALTER TABLE enriched_products ADD COLUMN IF NOT EXISTS cutout_url TEXT;

-- Index for faster lookups of products with cutouts
CREATE INDEX IF NOT EXISTS idx_enriched_products_cutout_url
  ON enriched_products(cutout_url)
  WHERE cutout_url IS NOT NULL;

-- Create storage bucket for cutouts (run in Supabase dashboard or via API)
-- Bucket name: cutouts
-- Public: true (for direct image access)

COMMENT ON COLUMN enriched_products.cutout_url IS 'URL to pre-processed product image with background removed, stored in Supabase cutouts bucket';
