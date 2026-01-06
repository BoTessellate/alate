-- Migration: Shopify Data Management Improvements
-- Date: 2026-01-06
-- Description: Add unique constraint, shop_name column, and uninstall tracking

-- ============================================================================
-- 1. Add UNIQUE constraint on (shop_domain, external_id) for UPSERT support
-- ============================================================================
-- This enables preserving enrichment data when re-syncing products

-- First, remove any duplicates if they exist (keep the most recently updated)
DELETE FROM enriched_products a
USING enriched_products b
WHERE a.id < b.id
  AND a.shop_domain = b.shop_domain
  AND a.external_id = b.external_id;

-- Now add the unique constraint
ALTER TABLE enriched_products
ADD CONSTRAINT unique_shop_product UNIQUE(shop_domain, external_id);

-- ============================================================================
-- 2. Add shop_name column to shopify_sessions
-- ============================================================================
-- Stores the display name of the shop (e.g., "Cool Fashion Store")

ALTER TABLE shopify_sessions
ADD COLUMN IF NOT EXISTS shop_name TEXT;

-- ============================================================================
-- 3. Create uninstall tracking table for GDPR-compliant data deletion
-- ============================================================================
-- Tracks when apps are uninstalled to enable 7-day grace period before deletion

CREATE TABLE IF NOT EXISTS shopify_uninstall_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain TEXT NOT NULL,
  uninstalled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleaned_up_at TIMESTAMPTZ,
  reinstalled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up by shop
CREATE INDEX IF NOT EXISTS idx_uninstall_shop
ON shopify_uninstall_log(shop_domain);

-- Index for finding pending cleanups (uninstalled > 7 days ago, not cleaned up, not reinstalled)
CREATE INDEX IF NOT EXISTS idx_uninstall_pending
ON shopify_uninstall_log(uninstalled_at)
WHERE cleaned_up_at IS NULL AND reinstalled = FALSE;

-- Enable RLS
ALTER TABLE shopify_uninstall_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access uninstall logs
CREATE POLICY "Service role access only" ON shopify_uninstall_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. Add index on enriched_products.enriched_at for efficient pending queries
-- ============================================================================
-- Speeds up queries for products that need enrichment

CREATE INDEX IF NOT EXISTS idx_products_pending_enrichment
ON enriched_products(shop_domain)
WHERE enriched_at IS NULL;

COMMENT ON TABLE shopify_uninstall_log IS 'Tracks app uninstalls for GDPR-compliant delayed data deletion';
COMMENT ON COLUMN shopify_sessions.shop_name IS 'Display name of the Shopify store';
COMMENT ON CONSTRAINT unique_shop_product ON enriched_products IS 'Ensures one product per shop, enables UPSERT';
