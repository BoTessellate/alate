-- Migration: Create job_queue table for async background processing
-- Used for cutout processing, batch enrichment, and other long-running tasks

CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority VARCHAR(10) NOT NULL DEFAULT 'normal',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  user_id UUID,
  metadata JSONB,

  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'critical'))
);

-- Index for fetching pending jobs by priority
CREATE INDEX IF NOT EXISTS idx_job_queue_pending
  ON job_queue(status, priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Index for job status lookups
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);

-- Index for user job history
CREATE INDEX IF NOT EXISTS idx_job_queue_user ON job_queue(user_id) WHERE user_id IS NOT NULL;

-- Index for job type queries
CREATE INDEX IF NOT EXISTS idx_job_queue_type ON job_queue(type);

COMMENT ON TABLE job_queue IS 'Background job queue for async processing (cutouts, enrichment, exports)';
COMMENT ON COLUMN job_queue.type IS 'Job type: process_cutout, enrich_product, generate_export, etc.';
COMMENT ON COLUMN job_queue.data IS 'Job-specific payload (productId, imageUrl, etc.)';
COMMENT ON COLUMN job_queue.status IS 'pending -> processing -> completed/failed/cancelled';
COMMENT ON COLUMN job_queue.priority IS 'low, normal, high, critical - determines processing order';
