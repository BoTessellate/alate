-- Migration: Add Enriched Columns to fit_history
-- Run this in Supabase SQL Editor to persist richer history entries
-- Date: 2026-04-05

-- Recommended size + confidence + note
ALTER TABLE fit_history
ADD COLUMN IF NOT EXISTS size_recommendation JSONB;

-- Product category (e.g. "dress", "pants")
ALTER TABLE fit_history
ADD COLUMN IF NOT EXISTS category TEXT;

-- Primary material (e.g. "cotton", "polyester")
ALTER TABLE fit_history
ADD COLUMN IF NOT EXISTS material TEXT;

-- AI-generated tags (e.g. ["midi", "fitted", "summer"])
ALTER TABLE fit_history
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Price snapshot at the time of the fit check
ALTER TABLE fit_history
ADD COLUMN IF NOT EXISTS price JSONB;

-- Brand name extracted from the product URL or scrape
ALTER TABLE fit_history
ADD COLUMN IF NOT EXISTS brand TEXT;

-- Indexes for filtering/sorting the history view
CREATE INDEX IF NOT EXISTS idx_fit_history_category ON fit_history(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fit_history_brand ON fit_history(brand) WHERE brand IS NOT NULL;

-- Column documentation
COMMENT ON COLUMN fit_history.size_recommendation IS 'Recommended size object: { size, confidence, note }';
COMMENT ON COLUMN fit_history.category IS 'Product category from AI enrichment (dress, pants, etc.)';
COMMENT ON COLUMN fit_history.material IS 'Primary material from AI enrichment';
COMMENT ON COLUMN fit_history.tags IS 'AI-generated style tags';
COMMENT ON COLUMN fit_history.price IS 'Price snapshot: { amount, currency }';
COMMENT ON COLUMN fit_history.brand IS 'Brand name (from scrape or URL domain)';
