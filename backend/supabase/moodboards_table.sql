-- =============================================================================
-- MOODBOARDS TABLE
-- =============================================================================
-- Stores user moodboards for the Alate mobile app
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS moodboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    user_id TEXT NOT NULL DEFAULT 'anonymous',

    -- Products stored as JSONB array
    -- Each product: { id, product_id, product, position: {x, y}, size: {width, height}, rotation, z_index, label }
    products JSONB DEFAULT '[]'::jsonb,

    -- Theme configuration
    theme JSONB,

    -- Canvas dimensions
    canvas_size JSONB DEFAULT '{"width": 1200, "height": 800}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_moodboards_user_id ON moodboards(user_id);
CREATE INDEX IF NOT EXISTS idx_moodboards_created_at ON moodboards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moodboards_updated_at ON moodboards(updated_at DESC);

-- Enable Row Level Security (optional - for authenticated users)
ALTER TABLE moodboards ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (adjust for production with auth)
CREATE POLICY "Allow all moodboard operations" ON moodboards
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Comments
COMMENT ON TABLE moodboards IS 'User moodboards for Alate mobile app';
COMMENT ON COLUMN moodboards.products IS 'Array of positioned products on the moodboard canvas';
COMMENT ON COLUMN moodboards.theme IS 'Generated theme colors and fonts for the moodboard';
COMMENT ON COLUMN moodboards.canvas_size IS 'Canvas dimensions in pixels: {width, height}';

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_moodboards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS moodboards_updated_at_trigger ON moodboards;
CREATE TRIGGER moodboards_updated_at_trigger
    BEFORE UPDATE ON moodboards
    FOR EACH ROW
    EXECUTE FUNCTION update_moodboards_updated_at();
