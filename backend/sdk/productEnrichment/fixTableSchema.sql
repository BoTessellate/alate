-- Fix enriched_products table schema
-- Makes user_id column nullable since this is a backend enrichment service
-- Run this in Supabase SQL Editor

-- Make user_id nullable (if it exists)
ALTER TABLE enriched_products
ALTER COLUMN user_id DROP NOT NULL;

-- OR if user_id doesn't exist yet, this will create it as nullable
-- ALTER TABLE enriched_products
-- ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'enriched_products table schema fixed!';
    RAISE NOTICE 'user_id is now nullable - backend services can insert without user context';
END $$;
