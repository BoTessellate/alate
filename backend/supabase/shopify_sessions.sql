-- ============================================================================
-- Shopify Sessions Table
-- Stores OAuth tokens and session data for connected Shopify stores
-- ============================================================================

-- Create shopify_sessions table
CREATE TABLE IF NOT EXISTS shopify_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,  -- AES-256-GCM encrypted
    scope TEXT NOT NULL,
    is_online BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    associated_user JSONB,  -- For online tokens
    state_nonce TEXT,  -- CSRF protection during OAuth
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for shop lookups
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop ON shopify_sessions(shop_domain);

-- Enable Row Level Security
ALTER TABLE shopify_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access
CREATE POLICY "Service role access only" ON shopify_sessions
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Add Shopify fields to enriched_products table
-- ============================================================================

-- Add shop_domain column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enriched_products' AND column_name = 'shop_domain'
    ) THEN
        ALTER TABLE enriched_products ADD COLUMN shop_domain TEXT;
    END IF;
END $$;

-- Add external_id column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enriched_products' AND column_name = 'external_id'
    ) THEN
        ALTER TABLE enriched_products ADD COLUMN external_id TEXT;
    END IF;
END $$;

-- Add platform column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enriched_products' AND column_name = 'platform'
    ) THEN
        ALTER TABLE enriched_products ADD COLUMN platform TEXT DEFAULT 'manual';
    END IF;
END $$;

-- Create unique index for external products (shop_domain + external_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_external
ON enriched_products(shop_domain, external_id)
WHERE external_id IS NOT NULL;

-- Index for platform queries
CREATE INDEX IF NOT EXISTS idx_products_platform ON enriched_products(platform);

-- Index for shop queries
CREATE INDEX IF NOT EXISTS idx_products_shop ON enriched_products(shop_domain)
WHERE shop_domain IS NOT NULL;

-- ============================================================================
-- Sync status tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopify_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_id TEXT NOT NULL,
    shop_domain TEXT NOT NULL,
    status TEXT NOT NULL,  -- 'started', 'completed', 'failed'
    products_synced INTEGER DEFAULT 0,
    products_enriched INTEGER DEFAULT 0,
    products_failed INTEGER DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

-- Index for shop sync history
CREATE INDEX IF NOT EXISTS idx_sync_logs_shop ON shopify_sync_logs(shop_domain, started_at DESC);

-- ============================================================================
-- Trigger to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_shopify_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shopify_sessions_updated_at ON shopify_sessions;
CREATE TRIGGER shopify_sessions_updated_at
    BEFORE UPDATE ON shopify_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_shopify_session_timestamp();
