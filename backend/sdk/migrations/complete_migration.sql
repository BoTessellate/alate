-- ============================================================================
-- STEL/MOODLAYER COMPLETE DATABASE MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================================================
-- This migration includes:
-- 1. Tag Feedback table (AI learning from user corrections)
-- 2. Color Mapping table (hex to fashion color names)
-- 3. Layout Feedback table (NEW - AI learning from layout adjustments)
-- 4. Helper functions and views
-- ============================================================================

-- ============================================================================
-- 1. TAG FEEDBACK TABLE (AI Learning)
-- ============================================================================
-- Captures user corrections to AI-generated tags for continuous improvement

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

-- Policies
CREATE POLICY "Allow service role full access on tag_feedback"
    ON tag_feedback
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read on tag_feedback"
    ON tag_feedback FOR SELECT
    TO authenticated
    USING (true);

-- View for common tag corrections
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

-- View for commonly added tags
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

-- ============================================================================
-- 2. COLOR MAPPING TABLE (Hex to Fashion Names)
-- ============================================================================

CREATE TABLE IF NOT EXISTS color_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hex_code VARCHAR(7) NOT NULL UNIQUE,  -- e.g., '#2C3E50'
    rgb_r INTEGER NOT NULL,
    rgb_g INTEGER NOT NULL,
    rgb_b INTEGER NOT NULL,

    -- Color names at different levels of specificity
    basic_name VARCHAR(50) NOT NULL,      -- e.g., 'blue', 'red', 'green'
    descriptive_name VARCHAR(100) NOT NULL, -- e.g., 'midnight blue', 'dusty rose'
    fashion_name VARCHAR(100),            -- e.g., 'navy', 'blush', 'cognac'

    -- Color properties for matching
    hue INTEGER,                          -- 0-360
    saturation INTEGER,                   -- 0-100
    lightness INTEGER,                    -- 0-100

    -- Mood/vibe associations
    warmth VARCHAR(20),                   -- 'warm', 'cool', 'neutral'
    season VARCHAR(50)[],                 -- ['summer', 'fall']
    mood VARCHAR(50)[],                   -- ['elegant', 'casual', 'bold']

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for color lookups
CREATE INDEX IF NOT EXISTS idx_color_mapping_hex ON color_mapping(hex_code);
CREATE INDEX IF NOT EXISTS idx_color_mapping_hsl ON color_mapping(hue, saturation, lightness);
CREATE INDEX IF NOT EXISTS idx_color_mapping_basic ON color_mapping(basic_name);

-- Insert 100+ fashion/lifestyle colors
INSERT INTO color_mapping (hex_code, rgb_r, rgb_g, rgb_b, basic_name, descriptive_name, fashion_name, hue, saturation, lightness, warmth, season, mood) VALUES
-- Neutrals
('#FFFFFF', 255, 255, 255, 'white', 'pure white', 'white', 0, 0, 100, 'neutral', ARRAY['all-season'], ARRAY['clean', 'minimal']),
('#F5F5F5', 245, 245, 245, 'white', 'off white', 'ivory', 0, 0, 96, 'warm', ARRAY['spring', 'summer'], ARRAY['soft', 'elegant']),
('#FAF0E6', 250, 240, 230, 'white', 'linen white', 'linen', 30, 67, 94, 'warm', ARRAY['summer'], ARRAY['natural', 'relaxed']),
('#FFFAF0', 255, 250, 240, 'white', 'floral white', 'cream', 40, 100, 97, 'warm', ARRAY['spring', 'summer'], ARRAY['soft', 'romantic']),
('#FFF8DC', 255, 248, 220, 'yellow', 'cornsilk', 'vanilla', 48, 100, 93, 'warm', ARRAY['summer'], ARRAY['soft', 'natural']),
('#000000', 0, 0, 0, 'black', 'jet black', 'noir', 0, 0, 0, 'neutral', ARRAY['all-season'], ARRAY['elegant', 'bold', 'sophisticated']),
('#1C1C1C', 28, 28, 28, 'black', 'onyx black', 'onyx', 0, 0, 11, 'neutral', ARRAY['fall', 'winter'], ARRAY['sophisticated']),
('#2F2F2F', 47, 47, 47, 'black', 'charcoal black', 'charcoal', 0, 0, 18, 'neutral', ARRAY['all-season'], ARRAY['professional']),
('#808080', 128, 128, 128, 'grey', 'medium grey', 'grey', 0, 0, 50, 'neutral', ARRAY['all-season'], ARRAY['understated']),
('#A9A9A9', 169, 169, 169, 'grey', 'dark grey', 'pewter', 0, 0, 66, 'cool', ARRAY['fall', 'winter'], ARRAY['sophisticated']),
('#D3D3D3', 211, 211, 211, 'grey', 'light grey', 'silver grey', 0, 0, 83, 'cool', ARRAY['summer'], ARRAY['minimal', 'modern']),
('#C0C0C0', 192, 192, 192, 'grey', 'silver', 'silver', 0, 0, 75, 'cool', ARRAY['winter'], ARRAY['elegant', 'festive']),
-- Browns & Beiges
('#F5DEB3', 245, 222, 179, 'beige', 'wheat', 'wheat', 39, 77, 83, 'warm', ARRAY['fall'], ARRAY['natural', 'earthy']),
('#D2B48C', 210, 180, 140, 'beige', 'tan', 'tan', 34, 44, 69, 'warm', ARRAY['fall', 'spring'], ARRAY['natural', 'casual']),
('#C4A77D', 196, 167, 125, 'beige', 'warm beige', 'camel', 35, 40, 63, 'warm', ARRAY['fall', 'winter'], ARRAY['classic', 'luxurious']),
('#8B7355', 139, 115, 85, 'brown', 'medium brown', 'cognac', 33, 24, 44, 'warm', ARRAY['fall', 'winter'], ARRAY['rich', 'sophisticated']),
('#5D4037', 93, 64, 55, 'brown', 'dark brown', 'espresso', 14, 26, 29, 'warm', ARRAY['fall', 'winter'], ARRAY['rich', 'grounded']),
('#3E2723', 62, 39, 35, 'brown', 'deep brown', 'chocolate', 9, 28, 19, 'warm', ARRAY['fall', 'winter'], ARRAY['luxurious', 'bold']),
('#8B4513', 139, 69, 19, 'brown', 'saddle brown', 'saddle', 25, 76, 31, 'warm', ARRAY['fall'], ARRAY['rustic', 'earthy']),
('#A0522D', 160, 82, 45, 'brown', 'sienna', 'sienna', 19, 56, 40, 'warm', ARRAY['fall'], ARRAY['earthy', 'artistic']),
('#CD853F', 205, 133, 63, 'brown', 'peru', 'caramel', 30, 59, 53, 'warm', ARRAY['fall'], ARRAY['rich', 'indulgent']),
('#DEB887', 222, 184, 135, 'beige', 'burlywood', 'butterscotch', 34, 57, 70, 'warm', ARRAY['fall', 'spring'], ARRAY['soft', 'natural']),
-- Blues
('#000080', 0, 0, 128, 'blue', 'navy blue', 'navy', 240, 100, 25, 'cool', ARRAY['fall', 'winter'], ARRAY['classic', 'professional', 'sophisticated']),
('#191970', 25, 25, 112, 'blue', 'midnight blue', 'midnight', 240, 64, 27, 'cool', ARRAY['fall', 'winter'], ARRAY['elegant', 'evening']),
('#2C3E50', 44, 62, 80, 'blue', 'dark slate blue', 'slate', 210, 29, 24, 'cool', ARRAY['fall', 'winter'], ARRAY['sophisticated', 'modern']),
('#4169E1', 65, 105, 225, 'blue', 'royal blue', 'royal', 225, 73, 57, 'cool', ARRAY['winter'], ARRAY['bold', 'regal']),
('#6495ED', 100, 149, 237, 'blue', 'cornflower blue', 'cornflower', 219, 79, 66, 'cool', ARRAY['spring', 'summer'], ARRAY['fresh', 'cheerful']),
('#87CEEB', 135, 206, 235, 'blue', 'sky blue', 'sky', 197, 71, 73, 'cool', ARRAY['spring', 'summer'], ARRAY['airy', 'fresh', 'calm']),
('#ADD8E6', 173, 216, 230, 'blue', 'light blue', 'powder blue', 195, 53, 79, 'cool', ARRAY['spring', 'summer'], ARRAY['soft', 'serene']),
('#5F9EA0', 95, 158, 160, 'blue', 'cadet blue', 'teal', 182, 25, 50, 'cool', ARRAY['fall'], ARRAY['balanced', 'calming']),
('#008B8B', 0, 139, 139, 'teal', 'dark cyan', 'deep teal', 180, 100, 27, 'cool', ARRAY['fall', 'winter'], ARRAY['sophisticated', 'bold']),
('#40E0D0', 64, 224, 208, 'teal', 'turquoise', 'turquoise', 174, 72, 56, 'cool', ARRAY['summer'], ARRAY['vibrant', 'tropical']),
-- Greens
('#006400', 0, 100, 0, 'green', 'dark green', 'forest', 120, 100, 20, 'cool', ARRAY['fall', 'winter'], ARRAY['natural', 'grounded']),
('#228B22', 34, 139, 34, 'green', 'forest green', 'hunter', 120, 61, 34, 'cool', ARRAY['fall'], ARRAY['natural', 'classic']),
('#2E8B57', 46, 139, 87, 'green', 'sea green', 'jade', 146, 50, 36, 'cool', ARRAY['spring', 'fall'], ARRAY['balanced', 'natural']),
('#3CB371', 60, 179, 113, 'green', 'medium sea green', 'seafoam', 147, 50, 47, 'cool', ARRAY['spring', 'summer'], ARRAY['fresh', 'natural']),
('#8FBC8F', 143, 188, 143, 'green', 'dark sea green', 'sage', 120, 25, 65, 'cool', ARRAY['spring', 'summer'], ARRAY['calming', 'natural', 'soft']),
('#90EE90', 144, 238, 144, 'green', 'light green', 'mint', 120, 73, 75, 'cool', ARRAY['spring', 'summer'], ARRAY['fresh', 'youthful']),
('#98FB98', 152, 251, 152, 'green', 'pale green', 'pistachio', 120, 93, 79, 'cool', ARRAY['spring'], ARRAY['fresh', 'light']),
('#6B8E23', 107, 142, 35, 'green', 'olive drab', 'olive', 80, 60, 35, 'warm', ARRAY['fall'], ARRAY['earthy', 'military']),
('#808000', 128, 128, 0, 'green', 'olive', 'olive', 60, 100, 25, 'warm', ARRAY['fall'], ARRAY['earthy', 'natural']),
('#556B2F', 85, 107, 47, 'green', 'dark olive green', 'moss', 82, 39, 30, 'warm', ARRAY['fall'], ARRAY['earthy', 'natural']),
-- Reds
('#8B0000', 139, 0, 0, 'red', 'dark red', 'burgundy', 0, 100, 27, 'warm', ARRAY['fall', 'winter'], ARRAY['rich', 'sophisticated', 'bold']),
('#B22222', 178, 34, 34, 'red', 'firebrick', 'brick red', 0, 68, 42, 'warm', ARRAY['fall'], ARRAY['bold', 'earthy']),
('#CD5C5C', 205, 92, 92, 'red', 'indian red', 'terracotta', 0, 53, 58, 'warm', ARRAY['fall'], ARRAY['earthy', 'warm']),
('#DC143C', 220, 20, 60, 'red', 'crimson', 'crimson', 348, 83, 47, 'warm', ARRAY['winter'], ARRAY['bold', 'passionate']),
('#FF0000', 255, 0, 0, 'red', 'pure red', 'scarlet', 0, 100, 50, 'warm', ARRAY['winter'], ARRAY['bold', 'energetic']),
('#FF6347', 255, 99, 71, 'red', 'tomato', 'coral red', 9, 100, 64, 'warm', ARRAY['summer'], ARRAY['vibrant', 'playful']),
('#E9967A', 233, 150, 122, 'red', 'dark salmon', 'salmon', 15, 72, 70, 'warm', ARRAY['spring', 'summer'], ARRAY['soft', 'warm']),
('#FA8072', 250, 128, 114, 'red', 'salmon', 'salmon pink', 6, 93, 71, 'warm', ARRAY['spring', 'summer'], ARRAY['soft', 'feminine']),
-- Pinks
('#FFC0CB', 255, 192, 203, 'pink', 'pink', 'rose pink', 350, 100, 88, 'warm', ARRAY['spring'], ARRAY['romantic', 'feminine', 'soft']),
('#FFB6C1', 255, 182, 193, 'pink', 'light pink', 'blush', 351, 100, 86, 'warm', ARRAY['spring', 'summer'], ARRAY['soft', 'romantic']),
('#FF69B4', 255, 105, 180, 'pink', 'hot pink', 'fuchsia', 330, 100, 71, 'warm', ARRAY['summer'], ARRAY['bold', 'playful', 'energetic']),
('#FF1493', 255, 20, 147, 'pink', 'deep pink', 'magenta', 328, 100, 54, 'warm', ARRAY['summer'], ARRAY['bold', 'vibrant']),
('#DB7093', 219, 112, 147, 'pink', 'pale violet red', 'dusty rose', 340, 60, 65, 'warm', ARRAY['fall', 'spring'], ARRAY['romantic', 'vintage']),
('#C71585', 199, 21, 133, 'pink', 'medium violet red', 'raspberry', 322, 81, 43, 'warm', ARRAY['fall', 'winter'], ARRAY['bold', 'rich']),
('#DDA0DD', 221, 160, 221, 'pink', 'plum', 'mauve', 300, 47, 75, 'cool', ARRAY['spring', 'fall'], ARRAY['soft', 'romantic']),
-- Purples
('#800080', 128, 0, 128, 'purple', 'purple', 'royal purple', 300, 100, 25, 'cool', ARRAY['fall', 'winter'], ARRAY['regal', 'luxurious']),
('#4B0082', 75, 0, 130, 'purple', 'indigo', 'indigo', 275, 100, 25, 'cool', ARRAY['fall', 'winter'], ARRAY['deep', 'mysterious']),
('#663399', 102, 51, 153, 'purple', 'rebecca purple', 'amethyst', 270, 50, 40, 'cool', ARRAY['fall'], ARRAY['sophisticated', 'creative']),
('#8A2BE2', 138, 43, 226, 'purple', 'blue violet', 'violet', 271, 76, 53, 'cool', ARRAY['spring'], ARRAY['vibrant', 'creative']),
('#9370DB', 147, 112, 219, 'purple', 'medium purple', 'lavender', 260, 60, 65, 'cool', ARRAY['spring', 'summer'], ARRAY['soft', 'romantic']),
('#E6E6FA', 230, 230, 250, 'purple', 'lavender', 'pale lavender', 240, 67, 94, 'cool', ARRAY['spring'], ARRAY['soft', 'calming', 'romantic']),
-- Oranges
('#FF8C00', 255, 140, 0, 'orange', 'dark orange', 'tangerine', 33, 100, 50, 'warm', ARRAY['fall'], ARRAY['vibrant', 'energetic']),
('#FF7F50', 255, 127, 80, 'orange', 'coral', 'coral', 16, 100, 66, 'warm', ARRAY['summer', 'spring'], ARRAY['warm', 'tropical']),
('#FFA500', 255, 165, 0, 'orange', 'orange', 'orange', 39, 100, 50, 'warm', ARRAY['fall'], ARRAY['energetic', 'cheerful']),
('#FF4500', 255, 69, 0, 'orange', 'orange red', 'burnt orange', 16, 100, 50, 'warm', ARRAY['fall'], ARRAY['bold', 'fiery']),
('#E2725B', 226, 114, 91, 'orange', 'terracotta', 'terracotta', 10, 69, 62, 'warm', ARRAY['fall'], ARRAY['earthy', 'warm', 'natural']),
-- Yellows
('#FFD700', 255, 215, 0, 'yellow', 'gold', 'gold', 51, 100, 50, 'warm', ARRAY['fall', 'winter'], ARRAY['luxurious', 'festive']),
('#FFFF00', 255, 255, 0, 'yellow', 'yellow', 'lemon', 60, 100, 50, 'warm', ARRAY['summer'], ARRAY['bright', 'cheerful']),
('#FFFACD', 255, 250, 205, 'yellow', 'lemon chiffon', 'butter', 54, 100, 90, 'warm', ARRAY['spring', 'summer'], ARRAY['soft', 'delicate']),
('#F0E68C', 240, 230, 140, 'yellow', 'khaki', 'khaki', 54, 77, 75, 'warm', ARRAY['spring', 'fall'], ARRAY['natural', 'casual']),
('#DAA520', 218, 165, 32, 'yellow', 'goldenrod', 'mustard', 43, 74, 49, 'warm', ARRAY['fall'], ARRAY['rich', 'earthy']),
('#BDB76B', 189, 183, 107, 'yellow', 'dark khaki', 'olive yellow', 56, 39, 58, 'warm', ARRAY['fall'], ARRAY['earthy', 'natural']),
('#B8860B', 184, 134, 11, 'yellow', 'dark goldenrod', 'antique gold', 43, 89, 38, 'warm', ARRAY['fall', 'winter'], ARRAY['rich', 'vintage'])
ON CONFLICT (hex_code) DO UPDATE SET
    descriptive_name = EXCLUDED.descriptive_name,
    fashion_name = EXCLUDED.fashion_name;

-- Function to find closest color match
CREATE OR REPLACE FUNCTION find_closest_color(
    p_hex VARCHAR(7)
) RETURNS TABLE (
    hex_code VARCHAR(7),
    basic_name VARCHAR(50),
    descriptive_name VARCHAR(100),
    fashion_name VARCHAR(100),
    distance FLOAT
) AS $$
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
    FROM color_mapping cm
    ORDER BY distance
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get color palette from array of hex codes
CREATE OR REPLACE FUNCTION get_color_palette_names(
    p_hex_codes TEXT[]
) RETURNS TABLE (
    input_hex TEXT,
    fashion_name VARCHAR(100),
    descriptive_name VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        hex_val as input_hex,
        (SELECT cm.fashion_name FROM color_mapping cm ORDER BY
            sqrt(
                power(cm.rgb_r - ('x' || substring(hex_val from 2 for 2))::bit(8)::integer, 2) +
                power(cm.rgb_g - ('x' || substring(hex_val from 4 for 2))::bit(8)::integer, 2) +
                power(cm.rgb_b - ('x' || substring(hex_val from 6 for 2))::bit(8)::integer, 2)
            )
        LIMIT 1) as fashion_name,
        (SELECT cm.descriptive_name FROM color_mapping cm ORDER BY
            sqrt(
                power(cm.rgb_r - ('x' || substring(hex_val from 2 for 2))::bit(8)::integer, 2) +
                power(cm.rgb_g - ('x' || substring(hex_val from 4 for 2))::bit(8)::integer, 2) +
                power(cm.rgb_b - ('x' || substring(hex_val from 6 for 2))::bit(8)::integer, 2)
            )
        LIMIT 1) as descriptive_name
    FROM unnest(p_hex_codes) as hex_val;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. LAYOUT FEEDBACK TABLE (NEW - AI Learning for Layout Generation)
-- ============================================================================
-- Captures user adjustments to AI-generated layouts for continuous improvement
-- The vision AI will use this to learn what makes a "good" layout

CREATE TABLE IF NOT EXISTS layout_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to the moodboard/look
    moodboard_id UUID,              -- Reference to the moodboard if stored
    look_id TEXT,                   -- Alternative identifier

    -- Layout context
    layout_type TEXT NOT NULL,      -- 'zigzag', 'centerpiece', 'grid', 'asymmetric', etc.
    product_count INTEGER NOT NULL, -- Number of products in layout
    canvas_width INTEGER NOT NULL,
    canvas_height INTEGER NOT NULL,

    -- Product categories in this layout (for learning category-specific preferences)
    product_categories TEXT[],      -- ['blazers-jackets', 'accessories', 'footwear']
    product_brands TEXT[],          -- Brands in this layout
    color_palettes TEXT[],          -- Dominant colors from products
    vibe_layer TEXT,                -- Overall mood ('evening-sophistication', 'weekend-retreat')

    -- AI-generated layout (original)
    ai_generated_layout JSONB NOT NULL,  -- Full layout JSON from AI
    -- Example structure:
    -- {
    --   "products": [
    --     { "id": "1", "name": "Blazer", "x": 100, "y": 50, "width": 200, "height": 250, "rotation": 0, "z_index": 1 },
    --     ...
    --   ],
    --   "labels": [
    --     { "product_name": "Blazer", "x": 150, "y": 310, "justification": "below image" },
    --     ...
    --   ]
    -- }

    -- User-adjusted layout (final)
    user_final_layout JSONB NOT NULL,    -- Layout after user adjustments

    -- Computed diffs for learning
    elements_moved INTEGER DEFAULT 0,     -- How many products were repositioned
    elements_resized INTEGER DEFAULT 0,   -- How many products were resized
    elements_rotated INTEGER DEFAULT 0,   -- How many products were rotated
    z_order_changed BOOLEAN DEFAULT FALSE, -- Was layering order changed
    labels_repositioned INTEGER DEFAULT 0, -- How many labels were moved

    -- Adjustment details (for fine-grained learning)
    adjustments JSONB,
    -- Example:
    -- [
    --   { "element_id": "1", "type": "move", "from": {"x": 100, "y": 50}, "to": {"x": 120, "y": 60}, "delta": {"x": 20, "y": 10} },
    --   { "element_id": "2", "type": "resize", "from": {"width": 200}, "to": {"width": 180}, "change_percent": -10 },
    --   { "element_id": "1", "type": "label_move", "from": {"x": 150}, "to": {"x": 130} }
    -- ]

    -- Quality signals
    user_rating INTEGER,                  -- Optional 1-5 rating from user
    was_exported BOOLEAN DEFAULT FALSE,   -- Did user export this layout (quality signal)
    time_spent_adjusting INTEGER,         -- Seconds spent adjusting (less = better initial layout)

    -- Metadata
    session_id TEXT,
    user_agent TEXT,                      -- Device info for responsive learning
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_layout_feedback_layout_type ON layout_feedback(layout_type);
CREATE INDEX IF NOT EXISTS idx_layout_feedback_product_count ON layout_feedback(product_count);
CREATE INDEX IF NOT EXISTS idx_layout_feedback_vibe_layer ON layout_feedback(vibe_layer);
CREATE INDEX IF NOT EXISTS idx_layout_feedback_categories ON layout_feedback USING GIN(product_categories);
CREATE INDEX IF NOT EXISTS idx_layout_feedback_created_at ON layout_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_layout_feedback_was_exported ON layout_feedback(was_exported);

-- Enable RLS
ALTER TABLE layout_feedback ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow service role full access on layout_feedback"
    ON layout_feedback
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read on layout_feedback"
    ON layout_feedback FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================================
-- LAYOUT FEEDBACK VIEWS (for AI learning prompts)
-- ============================================================================

-- View: Common position adjustments by layout type
-- Shows where AI typically places things wrong
CREATE OR REPLACE VIEW layout_position_patterns AS
SELECT
    layout_type,
    product_count,
    AVG(elements_moved) as avg_elements_moved,
    AVG(elements_resized) as avg_elements_resized,
    COUNT(*) as sample_count,
    AVG(time_spent_adjusting) as avg_adjustment_time
FROM layout_feedback
GROUP BY layout_type, product_count
ORDER BY sample_count DESC;

-- View: Successful layouts (exported with minimal adjustments)
CREATE OR REPLACE VIEW successful_layouts AS
SELECT
    id,
    layout_type,
    product_count,
    product_categories,
    vibe_layer,
    user_final_layout,
    time_spent_adjusting,
    user_rating
FROM layout_feedback
WHERE was_exported = TRUE
  AND elements_moved <= 2  -- Minimal repositioning needed
  AND (time_spent_adjusting IS NULL OR time_spent_adjusting < 60)
ORDER BY user_rating DESC NULLS LAST, created_at DESC;

-- View: Layout adjustments by category combination
CREATE OR REPLACE VIEW category_layout_preferences AS
SELECT
    product_categories,
    layout_type,
    COUNT(*) as usage_count,
    AVG(elements_moved) as avg_moves,
    AVG(CASE WHEN was_exported THEN 1 ELSE 0 END) as export_rate
FROM layout_feedback
WHERE product_categories IS NOT NULL
GROUP BY product_categories, layout_type
ORDER BY usage_count DESC;

-- ============================================================================
-- LAYOUT FEEDBACK FUNCTIONS
-- ============================================================================

-- Function: Get recent layout corrections for few-shot learning
CREATE OR REPLACE FUNCTION get_recent_layout_corrections(
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
) AS $$
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
    FROM layout_feedback lf
    WHERE
        (p_layout_type IS NULL OR lf.layout_type = p_layout_type)
        AND (p_product_count IS NULL OR lf.product_count = p_product_count)
        AND (lf.elements_moved > 0 OR lf.elements_resized > 0 OR lf.labels_repositioned > 0)
    ORDER BY lf.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Get successful layout examples for a given context
CREATE OR REPLACE FUNCTION get_successful_layout_examples(
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
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lf.layout_type,
        lf.product_count,
        lf.product_categories,
        lf.vibe_layer,
        lf.user_final_layout,
        lf.user_rating
    FROM layout_feedback lf
    WHERE
        lf.was_exported = TRUE
        AND (p_layout_type IS NULL OR lf.layout_type = p_layout_type)
        AND (p_product_count IS NULL OR lf.product_count BETWEEN p_product_count - 1 AND p_product_count + 1)
        AND (p_vibe_layer IS NULL OR lf.vibe_layer = p_vibe_layer)
        AND lf.elements_moved <= 2  -- Minimal corrections = good initial layout
    ORDER BY lf.user_rating DESC NULLS LAST, lf.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Analyze common adjustment patterns
CREATE OR REPLACE FUNCTION get_layout_adjustment_patterns(
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
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lf.layout_type,
        adj->>'type' as adjustment_type,
        AVG((adj->'delta'->>'x')::float) as avg_delta_x,
        AVG((adj->'delta'->>'y')::float) as avg_delta_y,
        AVG((adj->>'change_percent')::float) as avg_size_change_percent,
        COUNT(*) as occurrence_count
    FROM layout_feedback lf,
         jsonb_array_elements(lf.adjustments) as adj
    WHERE
        (p_layout_type IS NULL OR lf.layout_type = p_layout_type)
        AND lf.adjustments IS NOT NULL
    GROUP BY lf.layout_type, adj->>'type'
    ORDER BY occurrence_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. LABEL PLACEMENT FEEDBACK (Part of Layout Learning)
-- ============================================================================
-- Specialized tracking for label placement learning

CREATE TABLE IF NOT EXISTS label_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_feedback_id UUID REFERENCES layout_feedback(id) ON DELETE CASCADE,

    -- Label context
    product_name TEXT NOT NULL,
    product_category TEXT,

    -- AI placement
    ai_position JSONB NOT NULL,           -- { "x": 100, "y": 200 }
    ai_justification TEXT,                -- Why AI placed it there

    -- User adjustment
    user_position JSONB,                  -- Final position after adjustment
    was_adjusted BOOLEAN DEFAULT FALSE,

    -- Relationship to product image
    image_position JSONB,                 -- Product image bounds { "x", "y", "width", "height" }
    relative_placement TEXT,              -- 'above', 'below', 'left', 'right', 'overlay'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_label_feedback_category ON label_feedback(product_category);
CREATE INDEX IF NOT EXISTS idx_label_feedback_was_adjusted ON label_feedback(was_adjusted);
CREATE INDEX IF NOT EXISTS idx_label_feedback_relative ON label_feedback(relative_placement);

-- Enable RLS
ALTER TABLE label_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on label_feedback"
    ON label_feedback
    TO service_role
    USING (true)
    WITH CHECK (true);

-- View: Label placement patterns by category
CREATE OR REPLACE VIEW label_placement_patterns AS
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

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Complete migration finished successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - tag_feedback (AI learning from tag corrections)';
    RAISE NOTICE '  - color_mapping (% colors for hex-to-name mapping)', (SELECT COUNT(*) FROM color_mapping);
    RAISE NOTICE '  - layout_feedback (AI learning from layout adjustments)';
    RAISE NOTICE '  - label_feedback (AI learning from label placement)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created views:';
    RAISE NOTICE '  - tag_correction_patterns';
    RAISE NOTICE '  - tag_addition_patterns';
    RAISE NOTICE '  - layout_position_patterns';
    RAISE NOTICE '  - successful_layouts';
    RAISE NOTICE '  - category_layout_preferences';
    RAISE NOTICE '  - label_placement_patterns';
    RAISE NOTICE '';
    RAISE NOTICE 'Created functions:';
    RAISE NOTICE '  - get_recent_tag_corrections()';
    RAISE NOTICE '  - find_closest_color()';
    RAISE NOTICE '  - get_color_palette_names()';
    RAISE NOTICE '  - get_recent_layout_corrections()';
    RAISE NOTICE '  - get_successful_layout_examples()';
    RAISE NOTICE '  - get_layout_adjustment_patterns()';
END $$;
