-- =============================================================================
-- Moodlayer Database Schema
-- =============================================================================
-- Consolidated schema representing current database state
-- Last updated: 2024-12-17
-- =============================================================================

-- =============================================================================
-- API AUDIT LOG
-- =============================================================================
-- Tracks all secure API operations for security and debugging

CREATE TABLE IF NOT EXISTS api_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation TEXT NOT NULL,
    table_name TEXT,
    user_id UUID REFERENCES auth.users(id),
    ip_address TEXT,
    request_data JSONB,
    response_status TEXT NOT NULL CHECK (response_status IN ('success', 'error')),
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON api_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON api_audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON api_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON api_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_response_status ON api_audit_log(response_status);
CREATE INDEX IF NOT EXISTS idx_audit_log_ip_address ON api_audit_log(ip_address);

COMMENT ON TABLE api_audit_log IS 'Audit log for all secure API operations through Edge Functions';

ALTER TABLE api_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON api_audit_log
    FOR ALL
    USING (auth.role() = 'service_role');

-- Cleanup function for old audit logs (keeps 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM api_audit_log
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- BRAND INTEGRATIONS
-- =============================================================================
-- Stores platform integrations (Shopify, WooCommerce, etc.) for brands

CREATE TABLE IF NOT EXISTS brand_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('shopify', 'woocommerce', 'wix', 'csv')),
    shop_domain TEXT,
    access_token TEXT,
    sync_schedule JSONB DEFAULT '{"schedule_type": "manual", "is_active": true}'::jsonb,
    last_sync_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ,
    is_connected BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Sync mode (Task 05)
    sync_mode TEXT DEFAULT 'manual' CHECK (sync_mode IN ('auto', 'manual')),

    -- Health check columns
    status TEXT DEFAULT 'disconnected' CHECK (status IN ('ok', 'warning', 'disconnected')),
    status_notes TEXT,
    last_success TIMESTAMPTZ,
    last_failure TIMESTAMPTZ,

    UNIQUE(brand_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_brand_integrations_brand_id ON brand_integrations(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_integrations_platform ON brand_integrations(platform);
CREATE INDEX IF NOT EXISTS idx_brand_integrations_next_sync ON brand_integrations(next_sync_at);
CREATE INDEX IF NOT EXISTS idx_brand_integrations_is_connected ON brand_integrations(is_connected);
CREATE INDEX IF NOT EXISTS idx_brand_integrations_sync_mode ON brand_integrations(sync_mode);
CREATE INDEX IF NOT EXISTS idx_brand_integrations_status ON brand_integrations(status);
CREATE INDEX IF NOT EXISTS idx_brand_integrations_brand_status ON brand_integrations(brand_id, status);

COMMENT ON COLUMN brand_integrations.sync_mode IS 'Controls automatic vs manual syncing. auto=scheduled syncs, manual=user-triggered only';
COMMENT ON COLUMN brand_integrations.status IS 'Health status: ok (healthy), warning (stale), disconnected (failed)';
COMMENT ON COLUMN brand_integrations.status_notes IS 'Human-readable status description';
COMMENT ON COLUMN brand_integrations.last_success IS 'Timestamp of last successful health check';
COMMENT ON COLUMN brand_integrations.last_failure IS 'Timestamp of last failed health check';

ALTER TABLE brand_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access" ON brand_integrations
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Brands read own integrations" ON brand_integrations
    FOR SELECT
    USING (auth.uid() = brand_id);


-- =============================================================================
-- SYNC ERRORS
-- =============================================================================
-- Logs sync failures for debugging

CREATE TABLE IF NOT EXISTS sync_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    platform TEXT NOT NULL,
    sync_id UUID,
    error_message TEXT NOT NULL,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_errors_brand_id ON sync_errors(brand_id);
CREATE INDEX IF NOT EXISTS idx_sync_errors_sync_id ON sync_errors(sync_id);
CREATE INDEX IF NOT EXISTS idx_sync_errors_created_at ON sync_errors(created_at DESC);

ALTER TABLE sync_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only sync errors" ON sync_errors
    FOR ALL
    USING (auth.role() = 'service_role');


-- =============================================================================
-- ENRICHED PRODUCTS (Extensions)
-- =============================================================================
-- Note: Base enriched_products table created elsewhere
-- These are additional columns added by tasks 8-12

-- Variant support (Task 09)
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS product_dimensions JSONB;

ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS fit_tags TEXT[] DEFAULT '{}';

ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS platform TEXT CHECK (platform IN ('shopify', 'woocommerce', 'wix', 'csv'));

-- Canonical tags (Task 10)
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS canonical_tags TEXT[] DEFAULT '{}';

-- Image URLs (Task 12)
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS image_urls JSONB;

ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Indexes for enriched_products extensions
CREATE INDEX IF NOT EXISTS idx_enriched_products_external_id ON enriched_products(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enriched_products_platform ON enriched_products(platform) WHERE platform IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enriched_products_fit_tags ON enriched_products USING GIN (fit_tags);
CREATE INDEX IF NOT EXISTS idx_enriched_products_variants ON enriched_products USING GIN (variants);
CREATE INDEX IF NOT EXISTS idx_enriched_products_canonical_tags ON enriched_products USING GIN (canonical_tags);
CREATE INDEX IF NOT EXISTS idx_enriched_products_has_images ON enriched_products((image_urls IS NOT NULL));

-- Comments
COMMENT ON COLUMN enriched_products.variants IS 'Product variants with color/size/url/price/sku/image_url';
COMMENT ON COLUMN enriched_products.product_dimensions IS 'Physical dimensions: width, height, depth (cm), weight (kg)';
COMMENT ON COLUMN enriched_products.fit_tags IS 'Layout fit tags: bulky, flat, delicate, lightweight, oversized';
COMMENT ON COLUMN enriched_products.external_id IS 'External platform product ID (e.g., Shopify product ID)';
COMMENT ON COLUMN enriched_products.platform IS 'Source platform: shopify, woocommerce, wix, csv';
COMMENT ON COLUMN enriched_products.canonical_tags IS 'Taxonomy-normalized canonical tags for filtering and search';
COMMENT ON COLUMN enriched_products.image_urls IS 'CDN URLs for product images: original, thumb (256px), preview (768px), large (1440px)';
COMMENT ON COLUMN enriched_products.image_url IS 'Legacy single image URL. Use image_urls for CDN variants.';


-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Extract all colors from variants
CREATE OR REPLACE FUNCTION extract_variant_colors(variants JSONB)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT jsonb_array_elements_text(
      jsonb_path_query_array(variants, '$[*].color')
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Extract all sizes from variants
CREATE OR REPLACE FUNCTION extract_variant_sizes(variants JSONB)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT jsonb_array_elements_text(
      jsonb_path_query_array(variants, '$[*].size')
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate fit tags from dimensions
CREATE OR REPLACE FUNCTION calculate_fit_tags(dimensions JSONB)
RETURNS TEXT[] AS $$
DECLARE
  weight NUMERIC;
  volume NUMERIC;
  width NUMERIC;
  height NUMERIC;
  depth NUMERIC;
  weight_unit TEXT;
  tags TEXT[] := '{}';
BEGIN
  weight := (dimensions->>'weight')::NUMERIC;
  width := COALESCE((dimensions->>'width')::NUMERIC, 0);
  height := COALESCE((dimensions->>'height')::NUMERIC, 0);
  depth := COALESCE((dimensions->>'depth')::NUMERIC, 1);
  weight_unit := COALESCE(dimensions->>'weight_unit', 'kg');

  -- Convert weight to kg
  IF weight_unit = 'g' THEN
    weight := weight / 1000;
  ELSIF weight_unit = 'lbs' THEN
    weight := weight * 0.453592;
  ELSIF weight_unit = 'oz' THEN
    weight := weight * 0.0283495;
  END IF;

  volume := width * height * depth;

  IF weight > 5 THEN
    tags := array_append(tags, 'bulky');
  ELSIF weight < 0.5 AND weight > 0 THEN
    tags := array_append(tags, 'lightweight');
  END IF;

  IF volume > 50000 THEN
    tags := array_append(tags, 'oversized');
  ELSIF volume > 0 AND volume < 100 THEN
    tags := array_append(tags, 'delicate');
  END IF;

  IF height > 0 AND width > 0 AND depth > 0 THEN
    IF (width / NULLIF(depth, 0)) > 10 OR (height / NULLIF(depth, 0)) > 10 THEN
      tags := array_append(tags, 'flat');
    END IF;
  END IF;

  RETURN tags;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if tag array contains any of the given tags
CREATE OR REPLACE FUNCTION array_contains_any(arr TEXT[], search_tags TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN arr && search_tags;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if tag array contains all of the given tags
CREATE OR REPLACE FUNCTION array_contains_all(arr TEXT[], search_tags TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN arr @> search_tags;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if product has all image sizes
CREATE OR REPLACE FUNCTION has_all_image_sizes(urls JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN urls IS NOT NULL
    AND urls->>'original' IS NOT NULL
    AND urls->>'thumb' IS NOT NULL
    AND urls->>'preview' IS NOT NULL
    AND urls->>'large' IS NOT NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get appropriate image URL by size preference
CREATE OR REPLACE FUNCTION get_image_url(urls JSONB, preferred_size TEXT DEFAULT 'preview')
RETURNS TEXT AS $$
BEGIN
  IF urls IS NULL THEN
    RETURN NULL;
  END IF;

  IF urls->>preferred_size IS NOT NULL THEN
    RETURN urls->>preferred_size;
  END IF;

  -- Fallback order: preview -> large -> thumb -> original
  IF urls->>'preview' IS NOT NULL THEN
    RETURN urls->>'preview';
  ELSIF urls->>'large' IS NOT NULL THEN
    RETURN urls->>'large';
  ELSIF urls->>'thumb' IS NOT NULL THEN
    RETURN urls->>'thumb';
  ELSIF urls->>'original' IS NOT NULL THEN
    RETURN urls->>'original';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
