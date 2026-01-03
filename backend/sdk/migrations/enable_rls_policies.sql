-- ============================================================================
-- ROW LEVEL SECURITY POLICIES FOR ALL TABLES AND VIEWS
-- Run this in Supabase SQL Editor to secure your tables
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EXISTING POLICIES (if re-running)
-- ============================================================================

-- Drop existing policies to avoid conflicts (ignore errors if they don't exist)
DO $$
BEGIN
  -- enriched_products
  DROP POLICY IF EXISTS "enriched_products_select_policy" ON enriched_products;
  DROP POLICY IF EXISTS "enriched_products_insert_policy" ON enriched_products;
  DROP POLICY IF EXISTS "enriched_products_update_policy" ON enriched_products;
  DROP POLICY IF EXISTS "enriched_products_delete_policy" ON enriched_products;

  -- tag_feedback
  DROP POLICY IF EXISTS "tag_feedback_select_policy" ON tag_feedback;
  DROP POLICY IF EXISTS "tag_feedback_insert_policy" ON tag_feedback;
  DROP POLICY IF EXISTS "tag_feedback_update_policy" ON tag_feedback;
  DROP POLICY IF EXISTS "tag_feedback_delete_policy" ON tag_feedback;

  -- color_mapping
  DROP POLICY IF EXISTS "color_mapping_select_policy" ON color_mapping;
  DROP POLICY IF EXISTS "color_mapping_insert_policy" ON color_mapping;
  DROP POLICY IF EXISTS "color_mapping_update_policy" ON color_mapping;
  DROP POLICY IF EXISTS "color_mapping_delete_policy" ON color_mapping;

  -- layout_feedback
  DROP POLICY IF EXISTS "layout_feedback_select_policy" ON layout_feedback;
  DROP POLICY IF EXISTS "layout_feedback_insert_policy" ON layout_feedback;
  DROP POLICY IF EXISTS "layout_feedback_update_policy" ON layout_feedback;
  DROP POLICY IF EXISTS "layout_feedback_delete_policy" ON layout_feedback;

  -- label_feedback
  DROP POLICY IF EXISTS "label_feedback_select_policy" ON label_feedback;
  DROP POLICY IF EXISTS "label_feedback_insert_policy" ON label_feedback;
  DROP POLICY IF EXISTS "label_feedback_update_policy" ON label_feedback;
  DROP POLICY IF EXISTS "label_feedback_delete_policy" ON label_feedback;

  -- moodboards
  DROP POLICY IF EXISTS "moodboards_select_policy" ON moodboards;
  DROP POLICY IF EXISTS "moodboards_insert_policy" ON moodboards;
  DROP POLICY IF EXISTS "moodboards_update_policy" ON moodboards;
  DROP POLICY IF EXISTS "moodboards_delete_policy" ON moodboards;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors
END $$;

-- ============================================================================
-- 2. ENRICHED_PRODUCTS TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE enriched_products ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users and service role
CREATE POLICY "enriched_products_select_policy" ON enriched_products
  FOR SELECT
  USING (true);  -- Public read for product catalog

-- Allow insert/update only from service role (backend API)
CREATE POLICY "enriched_products_insert_policy" ON enriched_products
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "enriched_products_update_policy" ON enriched_products
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "enriched_products_delete_policy" ON enriched_products
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 2. TAG_FEEDBACK TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE tag_feedback ENABLE ROW LEVEL SECURITY;

-- Allow insert from service role (backend submits feedback)
CREATE POLICY "tag_feedback_insert_policy" ON tag_feedback
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Allow select from service role (for few-shot learning)
CREATE POLICY "tag_feedback_select_policy" ON tag_feedback
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Allow update/delete only from service role
CREATE POLICY "tag_feedback_update_policy" ON tag_feedback
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "tag_feedback_delete_policy" ON tag_feedback
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. COLOR_MAPPING TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE color_mapping ENABLE ROW LEVEL SECURITY;

-- Allow read access for all (color mapping is public reference data)
CREATE POLICY "color_mapping_select_policy" ON color_mapping
  FOR SELECT
  USING (true);

-- Only service role can modify color mappings
CREATE POLICY "color_mapping_insert_policy" ON color_mapping
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "color_mapping_update_policy" ON color_mapping
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "color_mapping_delete_policy" ON color_mapping
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. LAYOUT_FEEDBACK TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE layout_feedback ENABLE ROW LEVEL SECURITY;

-- Allow insert from service role (backend submits layout feedback)
CREATE POLICY "layout_feedback_insert_policy" ON layout_feedback
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Allow select from service role (for few-shot learning)
CREATE POLICY "layout_feedback_select_policy" ON layout_feedback
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Allow update/delete only from service role
CREATE POLICY "layout_feedback_update_policy" ON layout_feedback
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "layout_feedback_delete_policy" ON layout_feedback
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. LABEL_FEEDBACK TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE label_feedback ENABLE ROW LEVEL SECURITY;

-- Allow insert from service role
CREATE POLICY "label_feedback_insert_policy" ON label_feedback
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Allow select from service role (for few-shot learning)
CREATE POLICY "label_feedback_select_policy" ON label_feedback
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Allow update/delete only from service role
CREATE POLICY "label_feedback_update_policy" ON label_feedback
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "label_feedback_delete_policy" ON label_feedback
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 6. MOODBOARDS TABLE (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moodboards') THEN
    ALTER TABLE moodboards ENABLE ROW LEVEL SECURITY;

    -- Public read for moodboards
    CREATE POLICY "moodboards_select_policy" ON moodboards
      FOR SELECT USING (true);

    -- Service role for writes
    CREATE POLICY "moodboards_insert_policy" ON moodboards
      FOR INSERT WITH CHECK (auth.role() = 'service_role');

    CREATE POLICY "moodboards_update_policy" ON moodboards
      FOR UPDATE USING (auth.role() = 'service_role');

    CREATE POLICY "moodboards_delete_policy" ON moodboards
      FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- 7. RECREATE VIEWS WITH SECURITY_INVOKER = TRUE
-- Views inherit RLS from underlying tables when security_invoker is true
-- ============================================================================

-- Drop and recreate category_layout_preferences view
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

-- Drop and recreate layout_position_patterns view
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

-- Drop and recreate successful_layouts view
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

-- Drop and recreate label_placement_patterns view
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

-- Drop and recreate tag_correction_patterns view
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

-- Drop and recreate tag_addition_patterns view
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
-- VERIFICATION QUERIES
-- ============================================================================

-- Check RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'enriched_products',
    'tag_feedback',
    'color_mapping',
    'layout_feedback',
    'label_feedback',
    'moodboards'
  );

-- List all policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check views have security_invoker
SELECT
  table_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'category_layout_preferences',
    'layout_position_patterns',
    'successful_layouts',
    'label_placement_patterns',
    'tag_correction_patterns',
    'tag_addition_patterns'
  );
