-- ============================================================================
-- ENABLE RLS ON REMAINING PUBLIC TABLES
-- ============================================================================
-- Resolves Supabase security advisor finding `rls_disabled_in_public` for:
--   - job_queue           (async background job processing)
--   - shopify_sync_logs   (Shopify sync operation tracking)
--   - color_mapping       (fashion color reference data)
--
-- Idempotent: safe to re-run. Policy creation is guarded because Postgres
-- does not support CREATE POLICY IF NOT EXISTS.

-- ----------------------------------------------------------------------------
-- job_queue: internal-only, service role access
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS job_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'job_queue'
          AND policyname = 'Service role access only'
    ) THEN
        CREATE POLICY "Service role access only" ON job_queue
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- shopify_sync_logs: sensitive shop data, service role access
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS shopify_sync_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'shopify_sync_logs'
          AND policyname = 'Service role access only'
    ) THEN
        CREATE POLICY "Service role access only" ON shopify_sync_logs
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- color_mapping: reference data, readable by app, writable only by service
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS color_mapping ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'color_mapping'
          AND policyname = 'Authenticated and anon read'
    ) THEN
        CREATE POLICY "Authenticated and anon read" ON color_mapping
            FOR SELECT
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'color_mapping'
          AND policyname = 'Service role write'
    ) THEN
        CREATE POLICY "Service role write" ON color_mapping
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;
