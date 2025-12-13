-- Enriched Products table schema for Moodlayer
-- This is separate from the existing products table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS enriched_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    price DECIMAL(10, 2),
    region TEXT,
    color_palette TEXT[],
    tags TEXT[],
    texture TEXT,
    material TEXT,
    dimensions TEXT,
    tone TEXT,
    flags TEXT[],
    enriched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_enriched_products_brand ON enriched_products(brand);
CREATE INDEX IF NOT EXISTS idx_enriched_products_category ON enriched_products(category);
CREATE INDEX IF NOT EXISTS idx_enriched_products_region ON enriched_products(region);
CREATE INDEX IF NOT EXISTS idx_enriched_products_tags ON enriched_products USING GIN(tags);

-- Enable Row Level Security (RLS)
ALTER TABLE enriched_products ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read all products
CREATE POLICY "Allow authenticated read access"
    ON enriched_products FOR SELECT
    TO authenticated
    USING (true);

-- Policy to allow service role to insert/update products
CREATE POLICY "Allow service role full access"
    ON enriched_products
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_enriched_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_enriched_products_updated_at
    BEFORE UPDATE ON enriched_products
    FOR EACH ROW
    EXECUTE FUNCTION update_enriched_products_updated_at();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'enriched_products table created successfully!';
END $$;
