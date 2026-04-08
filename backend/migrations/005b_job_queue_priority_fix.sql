-- Migration: Fix job_queue priority ordering
-- Text-based priority sorts alphabetically (critical < high < low < normal)
-- Add numeric priority_order column for correct sorting

-- Add priority_order column
ALTER TABLE job_queue
ADD COLUMN IF NOT EXISTS priority_order INTEGER NOT NULL DEFAULT 2;

-- Set priority_order based on existing priority values
-- critical=4, high=3, normal=2, low=1
UPDATE job_queue SET priority_order = CASE priority
  WHEN 'critical' THEN 4
  WHEN 'high' THEN 3
  WHEN 'normal' THEN 2
  WHEN 'low' THEN 1
  ELSE 2
END;

-- Create function to auto-set priority_order on insert/update
CREATE OR REPLACE FUNCTION set_priority_order()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_order := CASE NEW.priority
    WHEN 'critical' THEN 4
    WHEN 'high' THEN 3
    WHEN 'normal' THEN 2
    WHEN 'low' THEN 1
    ELSE 2
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS job_queue_priority_order_trigger ON job_queue;
CREATE TRIGGER job_queue_priority_order_trigger
  BEFORE INSERT OR UPDATE OF priority ON job_queue
  FOR EACH ROW
  EXECUTE FUNCTION set_priority_order();

-- Update index to use priority_order instead of priority
DROP INDEX IF EXISTS idx_job_queue_pending;
CREATE INDEX idx_job_queue_pending
  ON job_queue(status, priority_order DESC, created_at ASC)
  WHERE status = 'pending';

COMMENT ON COLUMN job_queue.priority_order IS 'Numeric priority for sorting: critical=4, high=3, normal=2, low=1';
