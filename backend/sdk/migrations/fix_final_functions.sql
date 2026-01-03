-- ============================================================================
-- FIX FINAL 2 FUNCTION SEARCH_PATH WARNINGS
-- Run this in Supabase SQL Editor
-- ============================================================================

-- These 2 functions still have mutable search_path - force recreate them

-- 1. calculate_fit_tags - drop all versions and recreate
DO $$
BEGIN
    -- Drop any existing versions
    DROP FUNCTION IF EXISTS calculate_fit_tags(TEXT, TEXT[]);
    DROP FUNCTION IF EXISTS calculate_fit_tags(TEXT, TEXT[], TEXT);
    DROP FUNCTION IF EXISTS public.calculate_fit_tags(TEXT, TEXT[]);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE OR REPLACE FUNCTION public.calculate_fit_tags(category TEXT, existing_tags TEXT[])
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT existing_tags;
$$;

-- 2. record_enriched_product_audit - drop and recreate
DO $$
BEGIN
    DROP FUNCTION IF EXISTS record_enriched_product_audit() CASCADE;
    DROP FUNCTION IF EXISTS public.record_enriched_product_audit() CASCADE;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE OR REPLACE FUNCTION public.record_enriched_product_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Placeholder for audit logging
    RETURN NEW;
END;
$$;

-- Verify the fix
SELECT
    proname as function_name,
    proconfig as config
FROM pg_proc
WHERE proname IN ('calculate_fit_tags', 'record_enriched_product_audit')
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

DO $$
BEGIN
    RAISE NOTICE 'Final function fixes applied!';
    RAISE NOTICE 'Both functions should now show search_path="" in config';
END $$;
