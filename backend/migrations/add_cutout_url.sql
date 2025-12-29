-- Migration: Add cutout_url column to products table
-- Run this in Supabase SQL Editor when ready to enable background removal
--
-- STATUS: NOT YET APPLIED
-- Apply when: Real products are added and background removal is needed

-- Add cutout_url column to store processed product images (background removed)
ALTER TABLE products ADD COLUMN IF NOT EXISTS cutout_url TEXT;

-- Create storage bucket for cutouts (run in Supabase dashboard or via API)
-- Bucket name: cutouts
-- Public: true (for direct image access)

-- Index for faster lookups (optional, add if queries are slow)
-- CREATE INDEX idx_products_cutout_url ON products(cutout_url) WHERE cutout_url IS NOT NULL;

COMMENT ON COLUMN products.cutout_url IS 'URL to the product image with background removed, stored in Supabase Storage';
