-- ============================================================================
-- SECURITY FIX: Duplicate Policies + Function Search Path
-- Run this in Supabase SQL Editor to fix security warnings
-- ============================================================================
-- This migration:
-- 1. Removes ALL duplicate/conflicting policies
-- 2. Creates clean, single policies per operation
-- 3. Fixes function search_path to be immutable (security best practice)
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES (clean slate)
-- ============================================================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on our core tables
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN (
            'enriched_products',
            'tag_feedback',
            'color_mapping',
            'layout_feedback',
            'label_feedback',
            'moodboards',
            'brand_integrations',
            'shopify_sessions',
            'user_collections'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ============================================================================
-- STEP 2: CREATE CLEAN RLS POLICIES (one per operation per table)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENRICHED_PRODUCTS: Public read, service_role write
-- ----------------------------------------------------------------------------
ALTER TABLE enriched_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enriched_products_select" ON enriched_products
    FOR SELECT USING (true);  -- Public read for product catalog

CREATE POLICY "enriched_products_insert" ON enriched_products
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "enriched_products_update" ON enriched_products
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "enriched_products_delete" ON enriched_products
    FOR DELETE USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- TAG_FEEDBACK: Service role only (learning data)
-- ----------------------------------------------------------------------------
ALTER TABLE tag_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tag_feedback_select" ON tag_feedback
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "tag_feedback_insert" ON tag_feedback
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "tag_feedback_update" ON tag_feedback
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "tag_feedback_delete" ON tag_feedback
    FOR DELETE USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- COLOR_MAPPING: Public read (reference data), service_role write
-- ----------------------------------------------------------------------------
ALTER TABLE color_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "color_mapping_select" ON color_mapping
    FOR SELECT USING (true);

CREATE POLICY "color_mapping_insert" ON color_mapping
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "color_mapping_update" ON color_mapping
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "color_mapping_delete" ON color_mapping
    FOR DELETE USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- LAYOUT_FEEDBACK: Service role only (learning data)
-- ----------------------------------------------------------------------------
ALTER TABLE layout_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "layout_feedback_select" ON layout_feedback
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "layout_feedback_insert" ON layout_feedback
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "layout_feedback_update" ON layout_feedback
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "layout_feedback_delete" ON layout_feedback
    FOR DELETE USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- LABEL_FEEDBACK: Service role only (learning data)
-- ----------------------------------------------------------------------------
ALTER TABLE label_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "label_feedback_select" ON label_feedback
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "label_feedback_insert" ON label_feedback
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "label_feedback_update" ON label_feedback
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "label_feedback_delete" ON label_feedback
    FOR DELETE USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- MOODBOARDS: Public read, service_role write
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moodboards') THEN
        ALTER TABLE moodboards ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "moodboards_select" ON moodboards
            FOR SELECT USING (true);

        CREATE POLICY "moodboards_insert" ON moodboards
            FOR INSERT WITH CHECK (auth.role() = 'service_role');

        CREATE POLICY "moodboards_update" ON moodboards
            FOR UPDATE USING (auth.role() = 'service_role');

        CREATE POLICY "moodboards_delete" ON moodboards
            FOR DELETE USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- BRAND_INTEGRATIONS: Service role only
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brand_integrations') THEN
        ALTER TABLE brand_integrations ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "brand_integrations_select" ON brand_integrations
            FOR SELECT USING (auth.role() = 'service_role');

        CREATE POLICY "brand_integrations_insert" ON brand_integrations
            FOR INSERT WITH CHECK (auth.role() = 'service_role');

        CREATE POLICY "brand_integrations_update" ON brand_integrations
            FOR UPDATE USING (auth.role() = 'service_role');

        CREATE POLICY "brand_integrations_delete" ON brand_integrations
            FOR DELETE USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- SHOPIFY_SESSIONS: Service role only
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shopify_sessions') THEN
        ALTER TABLE shopify_sessions ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "shopify_sessions_select" ON shopify_sessions
            FOR SELECT USING (auth.role() = 'service_role');

        CREATE POLICY "shopify_sessions_insert" ON shopify_sessions
            FOR INSERT WITH CHECK (auth.role() = 'service_role');

        CREATE POLICY "shopify_sessions_update" ON shopify_sessions
            FOR UPDATE USING (auth.role() = 'service_role');

        CREATE POLICY "shopify_sessions_delete" ON shopify_sessions
            FOR DELETE USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- USER_COLLECTIONS: Service role only
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_collections') THEN
        ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "user_collections_select" ON user_collections
            FOR SELECT USING (auth.role() = 'service_role');

        CREATE POLICY "user_collections_insert" ON user_collections
            FOR INSERT WITH CHECK (auth.role() = 'service_role');

        CREATE POLICY "user_collections_update" ON user_collections
            FOR UPDATE USING (auth.role() = 'service_role');

        CREATE POLICY "user_collections_delete" ON user_collections
            FOR DELETE USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ============================================================================
-- STEP 3: FIX FUNCTION SEARCH_PATH (security best practice)
-- ============================================================================
-- Adding SET search_path = '' makes functions immutable to search_path attacks

-- Drop and recreate functions with secure search_path

-- 3.1 get_recent_tag_corrections
DROP FUNCTION IF EXISTS get_recent_tag_corrections(TEXT, TEXT, INT);
CREATE FUNCTION get_recent_tag_corrections(
    p_brand TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    brand TEXT,
    category TEXT,
    tags_removed TEXT[],
    tags_added TEXT[],
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tf.brand,
        tf.category,
        tf.tags_removed,
        tf.tags_added,
        tf.created_at
    FROM public.tag_feedback tf
    WHERE
        (p_brand IS NULL OR tf.brand ILIKE '%' || p_brand || '%')
        AND (p_category IS NULL OR tf.category = p_category)
        AND (array_length(tf.tags_removed, 1) > 0 OR array_length(tf.tags_added, 1) > 0)
    ORDER BY tf.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 3.2 find_closest_color
DROP FUNCTION IF EXISTS find_closest_color(VARCHAR);
CREATE FUNCTION find_closest_color(
    p_hex VARCHAR(7)
) RETURNS TABLE (
    hex_code VARCHAR(7),
    basic_name VARCHAR(50),
    descriptive_name VARCHAR(100),
    fashion_name VARCHAR(100),
    distance FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    input_r INTEGER;
    input_g INTEGER;
    input_b INTEGER;
BEGIN
    -- Parse input hex to RGB
    input_r := ('x' || substring(p_hex from 2 for 2))::bit(8)::integer;
    input_g := ('x' || substring(p_hex from 4 for 2))::bit(8)::integer;
    input_b := ('x' || substring(p_hex from 6 for 2))::bit(8)::integer;

    -- Find closest match using Euclidean distance in RGB space
    RETURN QUERY
    SELECT
        cm.hex_code,
        cm.basic_name,
        cm.descriptive_name,
        cm.fashion_name,
        sqrt(
            power(cm.rgb_r - input_r, 2) +
            power(cm.rgb_g - input_g, 2) +
            power(cm.rgb_b - input_b, 2)
        ) as distance
    FROM public.color_mapping cm
    ORDER BY distance
    LIMIT 1;
END;
$$;

-- 3.3 get_color_palette_names
DROP FUNCTION IF EXISTS get_color_palette_names(TEXT[]);
CREATE FUNCTION get_color_palette_names(
    p_hex_codes TEXT[]
) RETURNS TABLE (
    input_hex TEXT,
    fashion_name VARCHAR(100),
    descriptive_name VARCHAR(100)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        hex_val as input_hex,
        (SELECT cm.fashion_name FROM public.color_mapping cm ORDER BY
            sqrt(
                power(cm.rgb_r - ('x' || substring(hex_val from 2 for 2))::bit(8)::integer, 2) +
                power(cm.rgb_g - ('x' || substring(hex_val from 4 for 2))::bit(8)::integer, 2) +
                power(cm.rgb_b - ('x' || substring(hex_val from 6 for 2))::bit(8)::integer, 2)
            )
        LIMIT 1) as fashion_name,
        (SELECT cm.descriptive_name FROM public.color_mapping cm ORDER BY
            sqrt(
                power(cm.rgb_r - ('x' || substring(hex_val from 2 for 2))::bit(8)::integer, 2) +
                power(cm.rgb_g - ('x' || substring(hex_val from 4 for 2))::bit(8)::integer, 2) +
                power(cm.rgb_b - ('x' || substring(hex_val from 6 for 2))::bit(8)::integer, 2)
            )
        LIMIT 1) as descriptive_name
    FROM unnest(p_hex_codes) as hex_val;
END;
$$;

-- 3.4 get_recent_layout_corrections
DROP FUNCTION IF EXISTS get_recent_layout_corrections(TEXT, INTEGER, INT);
CREATE FUNCTION get_recent_layout_corrections(
    p_layout_type TEXT DEFAULT NULL,
    p_product_count INTEGER DEFAULT NULL,
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    layout_type TEXT,
    product_count INTEGER,
    product_categories TEXT[],
    vibe_layer TEXT,
    ai_layout JSONB,
    user_layout JSONB,
    adjustments JSONB,
    was_exported BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        lf.layout_type,
        lf.product_count,
        lf.product_categories,
        lf.vibe_layer,
        lf.ai_generated_layout,
        lf.user_final_layout,
        lf.adjustments,
        lf.was_exported
    FROM public.layout_feedback lf
    WHERE
        (p_layout_type IS NULL OR lf.layout_type = p_layout_type)
        AND (p_product_count IS NULL OR lf.product_count = p_product_count)
        AND (lf.elements_moved > 0 OR lf.elements_resized > 0 OR lf.labels_repositioned > 0)
    ORDER BY lf.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 3.5 get_successful_layout_examples
DROP FUNCTION IF EXISTS get_successful_layout_examples(TEXT, INTEGER, TEXT, INT);
CREATE FUNCTION get_successful_layout_examples(
    p_layout_type TEXT DEFAULT NULL,
    p_product_count INTEGER DEFAULT NULL,
    p_vibe_layer TEXT DEFAULT NULL,
    p_limit INT DEFAULT 3
)
RETURNS TABLE (
    layout_type TEXT,
    product_count INTEGER,
    product_categories TEXT[],
    vibe_layer TEXT,
    final_layout JSONB,
    user_rating INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        lf.layout_type,
        lf.product_count,
        lf.product_categories,
        lf.vibe_layer,
        lf.user_final_layout,
        lf.user_rating
    FROM public.layout_feedback lf
    WHERE
        lf.was_exported = TRUE
        AND (p_layout_type IS NULL OR lf.layout_type = p_layout_type)
        AND (p_product_count IS NULL OR lf.product_count BETWEEN p_product_count - 1 AND p_product_count + 1)
        AND (p_vibe_layer IS NULL OR lf.vibe_layer = p_vibe_layer)
        AND lf.elements_moved <= 2
    ORDER BY lf.user_rating DESC NULLS LAST, lf.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 3.6 get_layout_adjustment_patterns
DROP FUNCTION IF EXISTS get_layout_adjustment_patterns(TEXT, INT);
CREATE FUNCTION get_layout_adjustment_patterns(
    p_layout_type TEXT DEFAULT NULL,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    layout_type TEXT,
    adjustment_type TEXT,
    avg_delta_x FLOAT,
    avg_delta_y FLOAT,
    avg_size_change_percent FLOAT,
    occurrence_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        lf.layout_type,
        adj->>'type' as adjustment_type,
        AVG((adj->'delta'->>'x')::float) as avg_delta_x,
        AVG((adj->'delta'->>'y')::float) as avg_delta_y,
        AVG((adj->>'change_percent')::float) as avg_size_change_percent,
        COUNT(*) as occurrence_count
    FROM public.layout_feedback lf,
         jsonb_array_elements(lf.adjustments) as adj
    WHERE
        (p_layout_type IS NULL OR lf.layout_type = p_layout_type)
        AND lf.adjustments IS NOT NULL
    GROUP BY lf.layout_type, adj->>'type'
    ORDER BY occurrence_count DESC
    LIMIT p_limit;
END;
$$;

-- ============================================================================
-- STEP 4: RECREATE VIEWS WITH SECURITY_INVOKER = TRUE
-- ============================================================================

DROP VIEW IF EXISTS category_layout_preferences;
CREATE VIEW category_layout_preferences
WITH (security_invoker = true)
AS
SELECT
    layout_type,
    product_categories,
    COUNT(*) as usage_count,
    AVG(CASE WHEN was_exported THEN 1 ELSE 0 END) as export_rate,
    AVG(elements_moved) as avg_corrections,
    AVG(time_spent_adjusting) as avg_time_spent
FROM layout_feedback
WHERE product_categories IS NOT NULL
GROUP BY layout_type, product_categories
ORDER BY usage_count DESC;

DROP VIEW IF EXISTS layout_position_patterns;
CREATE VIEW layout_position_patterns
WITH (security_invoker = true)
AS
SELECT
    layout_type,
    product_count,
    COUNT(*) as sample_count,
    AVG(elements_moved) as avg_moves,
    AVG(elements_resized) as avg_resizes,
    AVG(labels_repositioned) as avg_label_moves
FROM layout_feedback
GROUP BY layout_type, product_count
ORDER BY layout_type, product_count;

DROP VIEW IF EXISTS successful_layouts;
CREATE VIEW successful_layouts
WITH (security_invoker = true)
AS
SELECT
    id,
    layout_type,
    product_count,
    user_final_layout,
    created_at
FROM layout_feedback
WHERE was_exported = true
  AND elements_moved <= 2
ORDER BY created_at DESC
LIMIT 100;

DROP VIEW IF EXISTS label_placement_patterns;
CREATE VIEW label_placement_patterns
WITH (security_invoker = true)
AS
SELECT
    product_category,
    relative_placement,
    COUNT(*) as total_placements,
    SUM(CASE WHEN was_adjusted THEN 1 ELSE 0 END) as adjustments_needed,
    ROUND(100.0 * SUM(CASE WHEN was_adjusted THEN 1 ELSE 0 END) / COUNT(*), 1) as adjustment_rate
FROM label_feedback
WHERE product_category IS NOT NULL
GROUP BY product_category, relative_placement
ORDER BY total_placements DESC;

DROP VIEW IF EXISTS tag_correction_patterns;
CREATE VIEW tag_correction_patterns
WITH (security_invoker = true)
AS
SELECT
    brand,
    category,
    unnest(tags_removed) as removed_tag,
    COUNT(*) as removal_count
FROM tag_feedback
WHERE tags_removed IS NOT NULL AND array_length(tags_removed, 1) > 0
GROUP BY brand, category, removed_tag
ORDER BY removal_count DESC;

DROP VIEW IF EXISTS tag_addition_patterns;
CREATE VIEW tag_addition_patterns
WITH (security_invoker = true)
AS
SELECT
    brand,
    category,
    unnest(tags_added) as added_tag,
    COUNT(*) as addition_count
FROM tag_feedback
WHERE tags_added IS NOT NULL AND array_length(tags_added, 1) > 0
GROUP BY brand, category, added_tag
ORDER BY addition_count DESC;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check policies are now clean (one per operation)
SELECT
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policies
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'enriched_products', 'tag_feedback', 'color_mapping',
    'layout_feedback', 'label_feedback', 'moodboards'
)
GROUP BY tablename
ORDER BY tablename;

-- Check functions have secure search_path
SELECT
    proname as function_name,
    proconfig as config
FROM pg_proc
WHERE proname IN (
    'get_recent_tag_corrections',
    'find_closest_color',
    'get_color_palette_names',
    'get_recent_layout_corrections',
    'get_successful_layout_examples',
    'get_layout_adjustment_patterns'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Security fixes applied successfully!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Fixed:';
    RAISE NOTICE '  - Removed duplicate/conflicting RLS policies';
    RAISE NOTICE '  - Created clean single policies per operation';
    RAISE NOTICE '  - Fixed function search_path (now immutable)';
    RAISE NOTICE '  - Recreated views with security_invoker';
    RAISE NOTICE '============================================';
END $$;
