-- =============================================================================
-- Brand requests — demand signal for unsupported brands
-- =============================================================================
-- Logs every URL paste that fails to scrape with kind='unsupported'.
-- Aggregate counts power two things:
--   1. In-app social proof on the FitResult error card ("23 others
--      have asked for this brand"). Gated at >= 20 — below that the
--      copy stays generic so a low count doesn't read as "no one
--      else cares".
--   2. Internal marketing/BD prioritisation: which storefronts get
--      the most paste-attempts each week, ranked by region.
--
-- Design notes:
--   - brand_handle is normalised host minus www; TLD is preserved.
--     'cosstores.com' and 'cosstores.in' are tracked separately
--     because integrations are per-storefront (Shopify Markets, geo-
--     pricing, etc. — see Reistor regression of 2026-04-29).
--   - requester_email is OPTIONAL and only present when the user
--     opts in to the "notify me when added" CTA. PII handling is
--     covered by the privacy policy + a deletion path; see
--     BACKLOG.md launch-checklist item.
--   - Service-role only writes/reads via RLS; the mobile client
--     never talks to Supabase directly, only through the
--     /api/brand-request Vercel function.
--   - No email goes out to the brand from this table. Email-the-
--     brand was rejected 2026-05-02 (see BACKLOG.md). This is a
--     demand-tracking table, not an outreach trigger.
-- =============================================================================

CREATE TABLE IF NOT EXISTS brand_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_handle TEXT NOT NULL,
    brand_display TEXT,
    source_url TEXT NOT NULL,
    requester_email TEXT,
    user_id TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_requests_handle
    ON brand_requests(brand_handle);
CREATE INDEX IF NOT EXISTS idx_brand_requests_at
    ON brand_requests(requested_at DESC);

COMMENT ON TABLE brand_requests IS
    'Demand signal for unsupported brands. Each row is one URL paste that hit an unsupported-brand error in FitResult.';
COMMENT ON COLUMN brand_requests.brand_handle IS
    'Normalised hostname minus www and scheme. TLD preserved (regional storefronts tracked separately).';
COMMENT ON COLUMN brand_requests.requester_email IS
    'Nullable. Only set when user opts in to "notify me when added" CTA. PII — must be deletable per privacy policy.';

ALTER TABLE brand_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON brand_requests
    FOR ALL
    USING (auth.role() = 'service_role');
