-- Migration: Create user_collections table for persistent collection storage
-- This replaces localStorage-only storage while maintaining backward compatibility

-- Create user_collections table
CREATE TABLE IF NOT EXISTS user_collections (
    id TEXT PRIMARY KEY,
    user_id TEXT, -- Optional: for future auth integration, NULL for anonymous users
    device_id TEXT, -- Fallback identifier for anonymous users
    name TEXT NOT NULL,
    description TEXT,
    products JSONB DEFAULT '[]'::jsonb,
    cover_images TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_device_id ON user_collections(device_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_updated_at ON user_collections(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (can be restricted later with auth)
-- This allows anonymous users to manage their collections
CREATE POLICY "Allow all operations on user_collections" ON user_collections
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_collections_updated_at ON user_collections;
CREATE TRIGGER trigger_user_collections_updated_at
    BEFORE UPDATE ON user_collections
    FOR EACH ROW
    EXECUTE FUNCTION update_user_collections_updated_at();

-- Add comment for documentation
COMMENT ON TABLE user_collections IS 'User-created collections of products, synced from frontend';
COMMENT ON COLUMN user_collections.device_id IS 'Browser fingerprint/ID for anonymous user identification';
COMMENT ON COLUMN user_collections.products IS 'JSONB array of Product objects with full metadata';
