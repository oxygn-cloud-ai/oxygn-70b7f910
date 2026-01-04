-- Phase 1.1: Add unique partial index to enforce execution mutex at DB level
-- This prevents race conditions when two executions try to start simultaneously

CREATE UNIQUE INDEX IF NOT EXISTS unique_running_trace 
ON q_execution_traces(entry_prompt_row_id, execution_type, owner_id) 
WHERE status = 'running';

-- Phase 2.4: Fix rate limit race condition by adding unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS unique_rate_limit_window 
ON q_rate_limits(user_id, endpoint, window_start);

-- Phase 3.1: Revoke direct execution of cleanup functions from public
REVOKE ALL ON FUNCTION cleanup_old_rate_limits() FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_orphaned_traces() FROM PUBLIC;

-- Phase 3.2: Add function to cleanup old traces (30+ days)
CREATE OR REPLACE FUNCTION cleanup_old_traces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM q_execution_traces 
  WHERE completed_at < now() - interval '30 days'
    AND status IN ('completed', 'failed', 'replaced', 'cancelled');
END;
$$;

-- Revoke direct access to this function too
REVOKE ALL ON FUNCTION cleanup_old_traces() FROM PUBLIC;