-- =============================================================================
-- Blocked brands — brand opt-out registry
-- =============================================================================
-- When a brand requests removal from Alate's scraping, their origin is
-- recorded here. The scraper checks this list before any fetch and
-- returns a `blocked: true` response instead of proceeding.
--
-- Origin is the URL hostname with `www.` stripped, lower-cased. Writes
-- are service-role only (enforced via RLS); reads happen from the
-- scraper with service-role credentials too, so the table is fully
-- gated behind the backend.
-- =============================================================================

CREATE TABLE IF NOT EXISTS blocked_brands (
    origin TEXT PRIMARY KEY,
    reason TEXT,
    requested_by_email TEXT,
    notes TEXT,
    blocked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_brands_blocked_at
    ON blocked_brands(blocked_at DESC);

COMMENT ON TABLE blocked_brands IS
    'Brands that have opted out of Alate scraping. Scraper consults this before every fetch.';
COMMENT ON COLUMN blocked_brands.origin IS
    'Normalised hostname (lowercase, no www. prefix, no scheme, no path).';

ALTER TABLE blocked_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON blocked_brands
    FOR ALL
    USING (auth.role() = 'service_role');
