-- Tag Feedback table for AI learning
-- Captures user corrections to AI-generated tags for continuous improvement
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS tag_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES enriched_products(id) ON DELETE CASCADE,

    -- Product context for learning
    brand TEXT,
    category TEXT,
    price_range TEXT,  -- 'budget', 'mid', 'premium', 'luxury'

    -- Tag tracking
    ai_generated_tags TEXT[] NOT NULL,    -- Original AI output
    user_final_tags TEXT[] NOT NULL,      -- After user edits
    tags_added TEXT[] DEFAULT '{}',       -- User additions (AI missed these)
    tags_removed TEXT[] DEFAULT '{}',     -- User removals (AI got these wrong)

    -- Metadata
    source_url TEXT,
    session_id TEXT,                      -- Track user sessions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tag_feedback_brand ON tag_feedback(brand);
CREATE INDEX IF NOT EXISTS idx_tag_feedback_category ON tag_feedback(category);
CREATE INDEX IF NOT EXISTS idx_tag_feedback_created_at ON tag_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tag_feedback_tags_added ON tag_feedback USING GIN(tags_added);
CREATE INDEX IF NOT EXISTS idx_tag_feedback_tags_removed ON tag_feedback USING GIN(tags_removed);

-- Enable RLS
ALTER TABLE tag_feedback ENABLE ROW LEVEL SECURITY;

-- Policy for service role
CREATE POLICY "Allow service role full access on tag_feedback"
    ON tag_feedback
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy for authenticated read (for analytics)
CREATE POLICY "Allow authenticated read on tag_feedback"
    ON tag_feedback FOR SELECT
    TO authenticated
    USING (true);

-- View for common tag corrections (useful for analytics)
CREATE OR REPLACE VIEW tag_correction_patterns AS
SELECT
    brand,
    category,
    unnest(tags_removed) as removed_tag,
    COUNT(*) as removal_count
FROM tag_feedback
WHERE array_length(tags_removed, 1) > 0
GROUP BY brand, category, removed_tag
ORDER BY removal_count DESC;

-- View for commonly added tags (AI is missing these)
CREATE OR REPLACE VIEW tag_addition_patterns AS
SELECT
    brand,
    category,
    unnest(tags_added) as added_tag,
    COUNT(*) as addition_count
FROM tag_feedback
WHERE array_length(tags_added, 1) > 0
GROUP BY brand, category, added_tag
ORDER BY addition_count DESC;

-- Function to get recent corrections for few-shot learning
CREATE OR REPLACE FUNCTION get_recent_tag_corrections(
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
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tf.brand,
        tf.category,
        tf.tags_removed,
        tf.tags_added,
        tf.created_at
    FROM tag_feedback tf
    WHERE
        (p_brand IS NULL OR tf.brand ILIKE '%' || p_brand || '%')
        AND (p_category IS NULL OR tf.category = p_category)
        AND (array_length(tf.tags_removed, 1) > 0 OR array_length(tf.tags_added, 1) > 0)
    ORDER BY tf.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'tag_feedback table and views created successfully!';
END $$;
