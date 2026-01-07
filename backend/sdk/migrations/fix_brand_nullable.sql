-- Fix: Allow NULL in brand column
-- Issue: Brand validation returns NULL for unidentifiable/fake brands
-- but the column had NOT NULL constraint, causing sync failures
-- Date: 2026-01-07

ALTER TABLE enriched_products ALTER COLUMN brand DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'enriched_products' AND column_name = 'brand';
