-- ============================================================================
-- AI TASK AUTONOMY TRACKING
-- ============================================================================
-- Tracks AI task execution to measure E2E autonomy rates
-- Helps understand which tasks AI can handle autonomously vs need checkpoints

CREATE TABLE IF NOT EXISTS ai_task_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Task identification
    task_type TEXT NOT NULL CHECK (task_type IN (
        'enrichment',    -- Product enrichment
        'search',        -- Search queries
        'layout',        -- Layout generation
        'label',         -- Label placement
        'debug',         -- Bug fixes (development)
        'feature',       -- Feature implementation (development)
        'refactor'       -- Code refactoring (development)
    )),
    complexity_tier INTEGER NOT NULL CHECK (complexity_tier BETWEEN 1 AND 5),
    -- Tier 1: Trivial (single-step, deterministic)
    -- Tier 2: Simple (multi-step but straightforward)
    -- Tier 3: Moderate (requires understanding context)
    -- Tier 4: Complex (multiple files, architectural decisions)
    -- Tier 5: Expert (cross-cutting, ambiguous requirements)

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Outcome tracking
    success BOOLEAN,
    human_interventions INTEGER DEFAULT 0,
    intervention_reasons TEXT[],

    -- User journey compliance (from morphic programming)
    journey_violations INTEGER DEFAULT 0,
    violation_descriptions TEXT[],

    -- Context for learning
    task_description TEXT NOT NULL,
    resolution_summary TEXT,

    -- Metadata
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_task_log_task_type ON ai_task_log(task_type);
CREATE INDEX IF NOT EXISTS idx_ai_task_log_complexity ON ai_task_log(complexity_tier);
CREATE INDEX IF NOT EXISTS idx_ai_task_log_completed ON ai_task_log(completed_at);
CREATE INDEX IF NOT EXISTS idx_ai_task_log_success ON ai_task_log(success);
CREATE INDEX IF NOT EXISTS idx_ai_task_log_created ON ai_task_log(created_at DESC);

-- Enable RLS
ALTER TABLE ai_task_log ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow service role full access on ai_task_log" ON ai_task_log;
CREATE POLICY "Allow service role full access on ai_task_log"
    ON ai_task_log
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert on ai_task_log" ON ai_task_log;
CREATE POLICY "Allow anon insert on ai_task_log"
    ON ai_task_log FOR INSERT
    TO anon
    WITH CHECK (true);

-- ============================================================================
-- AUTONOMY RATE VIEWS
-- ============================================================================

-- View: E2E autonomy rates by task type and complexity
DROP VIEW IF EXISTS task_autonomy_rates;
CREATE VIEW task_autonomy_rates
WITH (security_invoker = true)
AS
SELECT
    task_type,
    complexity_tier,
    COUNT(*) as total_tasks,
    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_tasks,
    AVG(human_interventions) as avg_interventions,
    SUM(CASE WHEN human_interventions = 0 AND success THEN 1 ELSE 0 END) as fully_autonomous,
    ROUND(
        100.0 * SUM(CASE WHEN human_interventions = 0 AND success THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
        1
    ) as e2e_autonomy_rate,
    SUM(journey_violations) as total_violations
FROM ai_task_log
WHERE completed_at IS NOT NULL
GROUP BY task_type, complexity_tier;

-- View: Overall autonomy summary
DROP VIEW IF EXISTS autonomy_summary;
CREATE VIEW autonomy_summary
WITH (security_invoker = true)
AS
SELECT
    task_type,
    COUNT(*) as total_tasks,
    ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as success_rate,
    ROUND(100.0 * SUM(CASE WHEN human_interventions = 0 AND success THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as e2e_rate,
    AVG(human_interventions) as avg_interventions_needed,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
FROM ai_task_log
WHERE completed_at IS NOT NULL
GROUP BY task_type;

-- View: Intervention reasons analysis
DROP VIEW IF EXISTS intervention_analysis;
CREATE VIEW intervention_analysis
WITH (security_invoker = true)
AS
SELECT
    task_type,
    complexity_tier,
    unnest(intervention_reasons) as reason,
    COUNT(*) as occurrence_count
FROM ai_task_log
WHERE intervention_reasons IS NOT NULL AND array_length(intervention_reasons, 1) > 0
GROUP BY task_type, complexity_tier, reason;

-- View: Journey violation patterns
DROP VIEW IF EXISTS journey_violation_patterns;
CREATE VIEW journey_violation_patterns
WITH (security_invoker = true)
AS
SELECT
    task_type,
    unnest(violation_descriptions) as violation,
    COUNT(*) as occurrence_count
FROM ai_task_log
WHERE violation_descriptions IS NOT NULL AND array_length(violation_descriptions, 1) > 0
GROUP BY task_type, violation;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Start a new task (returns task ID)
CREATE OR REPLACE FUNCTION start_ai_task(
    p_task_type TEXT,
    p_complexity_tier INTEGER,
    p_description TEXT,
    p_session_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_task_id UUID;
BEGIN
    INSERT INTO ai_task_log (task_type, complexity_tier, task_description, session_id)
    VALUES (p_task_type, p_complexity_tier, p_description, p_session_id)
    RETURNING id INTO v_task_id;

    RETURN v_task_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Log an intervention
CREATE OR REPLACE FUNCTION log_intervention(
    p_task_id UUID,
    p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE ai_task_log
    SET
        human_interventions = human_interventions + 1,
        intervention_reasons = array_append(COALESCE(intervention_reasons, ARRAY[]::TEXT[]), p_reason)
    WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Log a journey violation
CREATE OR REPLACE FUNCTION log_journey_violation(
    p_task_id UUID,
    p_violation TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE ai_task_log
    SET
        journey_violations = journey_violations + 1,
        violation_descriptions = array_append(COALESCE(violation_descriptions, ARRAY[]::TEXT[]), p_violation)
    WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Complete a task
CREATE OR REPLACE FUNCTION complete_ai_task(
    p_task_id UUID,
    p_success BOOLEAN,
    p_summary TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE ai_task_log
    SET
        completed_at = NOW(),
        success = p_success,
        resolution_summary = p_summary
    WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get autonomy rate for a task type
CREATE OR REPLACE FUNCTION get_autonomy_rate(
    p_task_type TEXT,
    p_complexity_tier INTEGER DEFAULT NULL
)
RETURNS TABLE (
    total_tasks BIGINT,
    e2e_rate DECIMAL,
    avg_interventions DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_tasks,
        ROUND(
            100.0 * SUM(CASE WHEN al.human_interventions = 0 AND al.success THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
            1
        ) as e2e_rate,
        AVG(al.human_interventions)::DECIMAL as avg_interventions
    FROM ai_task_log al
    WHERE
        al.task_type = p_task_type
        AND (p_complexity_tier IS NULL OR al.complexity_tier = p_complexity_tier)
        AND al.completed_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ AI Task Autonomy Tracking migration complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  - ai_task_log table';
    RAISE NOTICE '  - task_autonomy_rates view';
    RAISE NOTICE '  - autonomy_summary view';
    RAISE NOTICE '  - intervention_analysis view';
    RAISE NOTICE '  - journey_violation_patterns view';
    RAISE NOTICE '  - start_ai_task() function';
    RAISE NOTICE '  - log_intervention() function';
    RAISE NOTICE '  - log_journey_violation() function';
    RAISE NOTICE '  - complete_ai_task() function';
    RAISE NOTICE '  - get_autonomy_rate() function';
    RAISE NOTICE '';
    RAISE NOTICE 'Usage:';
    RAISE NOTICE '  1. Call start_ai_task() when starting a task';
    RAISE NOTICE '  2. Call log_intervention() when human help is needed';
    RAISE NOTICE '  3. Call complete_ai_task() when done';
    RAISE NOTICE '  4. Query task_autonomy_rates to see E2E rates';
END $$;
