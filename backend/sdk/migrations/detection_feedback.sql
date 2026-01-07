-- ============================================================================
-- DETECTION FEEDBACK TABLE (AI Learning for Product Detection)
-- ============================================================================
-- Captures user corrections to AI-generated bounding boxes for continuous improvement
-- This complements tag_feedback and layout_feedback tables

CREATE TABLE IF NOT EXISTS detection_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to the product (if it was created)
    product_id UUID,                      -- References enriched_products if saved

    -- Original image context
    original_image_url TEXT NOT NULL,     -- URL of the full uploaded image
    original_image_width INTEGER,         -- Image dimensions for normalization
    original_image_height INTEGER,

    -- Detection context
    context TEXT NOT NULL CHECK (context IN ('fashion', 'home')),
    product_index INTEGER DEFAULT 0,      -- Which product in multi-detect (0-indexed)
    total_products_detected INTEGER,      -- How many products AI found

    -- AI-generated bounding box (original)
    ai_bounding_box JSONB NOT NULL,       -- { "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4 }
    ai_suggested_name TEXT,
    ai_category TEXT,
    ai_confidence DECIMAL(3,2),

    -- User-corrected bounding box (final)
    user_bounding_box JSONB NOT NULL,     -- { "x": 0.15, "y": 0.25, "width": 0.35, "height": 0.45 }
    user_product_name TEXT,               -- User's corrected name
    user_category TEXT,                   -- User's corrected category

    -- Computed diffs for learning
    box_moved BOOLEAN DEFAULT FALSE,      -- Did position change significantly?
    box_resized BOOLEAN DEFAULT FALSE,    -- Did size change significantly?
    position_delta JSONB,                 -- { "x": 0.05, "y": 0.05 } - how much it moved
    size_delta JSONB,                     -- { "width": 0.05, "height": 0.05 } - how much it resized

    -- Quality signals
    was_product_saved BOOLEAN DEFAULT FALSE,  -- Did user proceed with this product?
    was_completely_wrong BOOLEAN DEFAULT FALSE,  -- Was AI detection totally off?

    -- Cropped images for reference
    ai_cropped_url TEXT,                  -- URL of AI's crop
    user_cropped_url TEXT,                -- URL of user's adjusted crop

    -- Metadata
    device_id TEXT,
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_detection_feedback_context ON detection_feedback(context);
CREATE INDEX IF NOT EXISTS idx_detection_feedback_ai_category ON detection_feedback(ai_category);
CREATE INDEX IF NOT EXISTS idx_detection_feedback_user_category ON detection_feedback(user_category);
CREATE INDEX IF NOT EXISTS idx_detection_feedback_confidence ON detection_feedback(ai_confidence);
CREATE INDEX IF NOT EXISTS idx_detection_feedback_created_at ON detection_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detection_feedback_was_wrong ON detection_feedback(was_completely_wrong);
CREATE INDEX IF NOT EXISTS idx_detection_feedback_was_saved ON detection_feedback(was_product_saved);

-- Enable RLS
ALTER TABLE detection_feedback ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow service role full access on detection_feedback"
    ON detection_feedback
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon insert on detection_feedback"
    ON detection_feedback FOR INSERT
    TO anon
    WITH CHECK (true);

-- ============================================================================
-- DETECTION FEEDBACK VIEWS (for AI learning prompts)
-- ============================================================================

-- View: Common detection errors by category
CREATE OR REPLACE VIEW detection_error_patterns AS
SELECT
    context,
    ai_category,
    COUNT(*) as total_detections,
    SUM(CASE WHEN box_moved THEN 1 ELSE 0 END) as position_corrections,
    SUM(CASE WHEN box_resized THEN 1 ELSE 0 END) as size_corrections,
    SUM(CASE WHEN was_completely_wrong THEN 1 ELSE 0 END) as completely_wrong,
    AVG(ai_confidence) as avg_ai_confidence,
    ROUND(100.0 * SUM(CASE WHEN was_product_saved THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as save_rate
FROM detection_feedback
GROUP BY context, ai_category
ORDER BY total_detections DESC;

-- View: Position adjustment patterns (where does AI typically mis-position?)
CREATE OR REPLACE VIEW detection_position_patterns AS
SELECT
    context,
    ai_category,
    AVG((position_delta->>'x')::float) as avg_x_correction,
    AVG((position_delta->>'y')::float) as avg_y_correction,
    COUNT(*) as sample_count
FROM detection_feedback
WHERE box_moved = TRUE AND position_delta IS NOT NULL
GROUP BY context, ai_category
HAVING COUNT(*) >= 3
ORDER BY sample_count DESC;

-- View: Size adjustment patterns (how does AI typically mis-size?)
CREATE OR REPLACE VIEW detection_size_patterns AS
SELECT
    context,
    ai_category,
    AVG((size_delta->>'width')::float) as avg_width_correction,
    AVG((size_delta->>'height')::float) as avg_height_correction,
    COUNT(*) as sample_count
FROM detection_feedback
WHERE box_resized = TRUE AND size_delta IS NOT NULL
GROUP BY context, ai_category
HAVING COUNT(*) >= 3
ORDER BY sample_count DESC;

-- ============================================================================
-- DETECTION FEEDBACK FUNCTIONS
-- ============================================================================

-- Function: Get recent detection corrections for few-shot learning
CREATE OR REPLACE FUNCTION get_recent_detection_corrections(
    p_context TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    context TEXT,
    ai_category TEXT,
    ai_bounding_box JSONB,
    user_bounding_box JSONB,
    ai_suggested_name TEXT,
    user_product_name TEXT,
    position_delta JSONB,
    size_delta JSONB,
    was_completely_wrong BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        df.context,
        df.ai_category,
        df.ai_bounding_box,
        df.user_bounding_box,
        df.ai_suggested_name,
        df.user_product_name,
        df.position_delta,
        df.size_delta,
        df.was_completely_wrong
    FROM detection_feedback df
    WHERE
        (p_context IS NULL OR df.context = p_context)
        AND (p_category IS NULL OR df.ai_category ILIKE '%' || p_category || '%')
        AND (df.box_moved = TRUE OR df.box_resized = TRUE OR df.was_completely_wrong = TRUE)
    ORDER BY df.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Get successful detections (high confidence, no corrections needed)
CREATE OR REPLACE FUNCTION get_successful_detections(
    p_context TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    context TEXT,
    ai_category TEXT,
    ai_bounding_box JSONB,
    ai_suggested_name TEXT,
    ai_confidence DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        df.context,
        df.ai_category,
        df.ai_bounding_box,
        df.ai_suggested_name,
        df.ai_confidence
    FROM detection_feedback df
    WHERE
        (p_context IS NULL OR df.context = p_context)
        AND (p_category IS NULL OR df.ai_category ILIKE '%' || p_category || '%')
        AND df.was_product_saved = TRUE
        AND df.box_moved = FALSE
        AND df.box_resized = FALSE
        AND df.was_completely_wrong = FALSE
    ORDER BY df.ai_confidence DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate correction statistics for a category
CREATE OR REPLACE FUNCTION get_detection_stats(
    p_context TEXT,
    p_category TEXT
)
RETURNS TABLE (
    total_detections BIGINT,
    correction_rate DECIMAL,
    avg_confidence DECIMAL,
    avg_x_correction DECIMAL,
    avg_y_correction DECIMAL,
    avg_width_correction DECIMAL,
    avg_height_correction DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_detections,
        ROUND(100.0 * SUM(CASE WHEN df.box_moved OR df.box_resized THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as correction_rate,
        AVG(df.ai_confidence)::DECIMAL as avg_confidence,
        AVG((df.position_delta->>'x')::float)::DECIMAL as avg_x_correction,
        AVG((df.position_delta->>'y')::float)::DECIMAL as avg_y_correction,
        AVG((df.size_delta->>'width')::float)::DECIMAL as avg_width_correction,
        AVG((df.size_delta->>'height')::float)::DECIMAL as avg_height_correction
    FROM detection_feedback df
    WHERE
        df.context = p_context
        AND df.ai_category ILIKE '%' || p_category || '%';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Detection feedback migration complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  - detection_feedback table';
    RAISE NOTICE '  - detection_error_patterns view';
    RAISE NOTICE '  - detection_position_patterns view';
    RAISE NOTICE '  - detection_size_patterns view';
    RAISE NOTICE '  - get_recent_detection_corrections() function';
    RAISE NOTICE '  - get_successful_detections() function';
    RAISE NOTICE '  - get_detection_stats() function';
    RAISE NOTICE '';
    RAISE NOTICE 'This enables AI to learn from bounding box corrections!';
END $$;
