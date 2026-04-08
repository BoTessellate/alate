-- Migration: Add type column to user_collections for distinguishing collections from outfits
-- This allows users to save specific outfit combinations vs general product collections

-- Add type column with default 'collection' for existing records
ALTER TABLE user_collections
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'collection' CHECK (type IN ('collection', 'outfit'));

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_user_collections_type ON user_collections(type);
