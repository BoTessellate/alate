-- ============================================================================
-- FIX SECURITY DEFINER VIEWS
-- ============================================================================
-- Changes views from SECURITY DEFINER to SECURITY INVOKER
-- This ensures views use the querying user's permissions, not the creator's

-- Drop and recreate views with explicit SECURITY INVOKER

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

-- Grant SELECT on views to appropriate roles
GRANT SELECT ON task_autonomy_rates TO anon, authenticated, service_role;
GRANT SELECT ON autonomy_summary TO anon, authenticated, service_role;
GRANT SELECT ON intervention_analysis TO anon, authenticated, service_role;
GRANT SELECT ON journey_violation_patterns TO anon, authenticated, service_role;
