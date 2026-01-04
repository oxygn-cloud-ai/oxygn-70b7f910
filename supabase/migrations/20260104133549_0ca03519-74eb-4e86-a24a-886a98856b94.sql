-- ============================================================================
-- PHASE 2: Execution Tracking System Database Schema
-- ============================================================================

-- 2.1 Add root_prompt_row_id column to q_prompts for family scoping
ALTER TABLE q_prompts 
ADD COLUMN IF NOT EXISTS root_prompt_row_id UUID REFERENCES q_prompts(row_id);

-- 2.2 Add family_version to track structural changes
ALTER TABLE q_prompts
ADD COLUMN IF NOT EXISTS family_version INTEGER DEFAULT 1;

-- 2.3 Create index for efficient family queries
CREATE INDEX IF NOT EXISTS idx_prompts_root_id ON q_prompts(root_prompt_row_id) 
WHERE is_deleted = false;

-- 2.4 Create trigger function with cycle detection to compute root_prompt_row_id
CREATE OR REPLACE FUNCTION compute_root_prompt_row_id()
RETURNS TRIGGER AS $$
DECLARE
  current_id UUID;
  visited_ids UUID[] := ARRAY[]::UUID[];
  max_depth INTEGER := 20;
  depth INTEGER := 0;
BEGIN
  -- If no parent, this is the root
  IF NEW.parent_row_id IS NULL THEN
    NEW.root_prompt_row_id := NEW.row_id;
    RETURN NEW;
  END IF;

  -- Walk up parent chain with cycle detection
  current_id := NEW.parent_row_id;
  WHILE current_id IS NOT NULL AND depth < max_depth LOOP
    -- Check for cycle
    IF current_id = ANY(visited_ids) THEN
      RAISE EXCEPTION 'Cycle detected in prompt hierarchy at %', current_id;
    END IF;
    
    visited_ids := array_append(visited_ids, current_id);
    depth := depth + 1;
    
    SELECT parent_row_id INTO current_id
    FROM q_prompts
    WHERE row_id = visited_ids[depth];
  END LOOP;

  -- Root is the last visited ID that has no parent
  IF array_length(visited_ids, 1) > 0 THEN
    NEW.root_prompt_row_id := visited_ids[array_length(visited_ids, 1)];
  ELSE
    NEW.root_prompt_row_id := NEW.row_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.5 Create trigger to auto-populate root_prompt_row_id
DROP TRIGGER IF EXISTS trg_compute_root_prompt ON q_prompts;
CREATE TRIGGER trg_compute_root_prompt
BEFORE INSERT OR UPDATE OF parent_row_id ON q_prompts
FOR EACH ROW EXECUTE FUNCTION compute_root_prompt_row_id();

-- 2.6 Create function to increment family version on structural changes
CREATE OR REPLACE FUNCTION increment_family_version()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT of child prompt, increment root's version
  IF TG_OP = 'INSERT' AND NEW.parent_row_id IS NOT NULL AND NEW.root_prompt_row_id IS NOT NULL THEN
    UPDATE q_prompts 
    SET family_version = COALESCE(family_version, 1) + 1
    WHERE row_id = NEW.root_prompt_row_id;
  END IF;
  
  -- On soft delete, increment root's version
  IF TG_OP = 'UPDATE' AND OLD.is_deleted = false AND NEW.is_deleted = true AND NEW.root_prompt_row_id IS NOT NULL THEN
    UPDATE q_prompts 
    SET family_version = COALESCE(family_version, 1) + 1
    WHERE row_id = NEW.root_prompt_row_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_family_version ON q_prompts;
CREATE TRIGGER trg_increment_family_version
AFTER INSERT OR UPDATE ON q_prompts
FOR EACH ROW EXECUTE FUNCTION increment_family_version();

-- 2.7 Backfill existing prompts with root_prompt_row_id
WITH RECURSIVE prompt_hierarchy AS (
  -- Base case: root prompts (no parent)
  SELECT row_id, row_id as root_id, 1 as depth
  FROM q_prompts
  WHERE parent_row_id IS NULL AND (is_deleted = false OR is_deleted IS NULL)
  
  UNION ALL
  
  -- Recursive case: children
  SELECT p.row_id, ph.root_id, ph.depth + 1
  FROM q_prompts p
  JOIN prompt_hierarchy ph ON p.parent_row_id = ph.row_id
  WHERE (p.is_deleted = false OR p.is_deleted IS NULL) AND ph.depth < 20
)
UPDATE q_prompts p
SET root_prompt_row_id = ph.root_id
FROM prompt_hierarchy ph
WHERE p.row_id = ph.row_id AND p.root_prompt_row_id IS NULL;

-- Set root_prompt_row_id for root prompts themselves
UPDATE q_prompts
SET root_prompt_row_id = row_id
WHERE parent_row_id IS NULL AND root_prompt_row_id IS NULL;

-- ============================================================================
-- 2.8 Create q_execution_traces table
-- ============================================================================
CREATE TABLE IF NOT EXISTS q_execution_traces (
  trace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  root_prompt_row_id UUID NOT NULL REFERENCES q_prompts(row_id) ON DELETE CASCADE,
  entry_prompt_row_id UUID NOT NULL REFERENCES q_prompts(row_id) ON DELETE CASCADE,
  execution_type TEXT NOT NULL CHECK (execution_type IN ('single', 'cascade_top', 'cascade_child')),
  owner_id UUID NOT NULL,
  thread_row_id UUID REFERENCES q_threads(row_id) ON DELETE SET NULL,
  family_version_at_start INTEGER NOT NULL DEFAULT 1,
  prompt_ids_at_start JSONB NOT NULL DEFAULT '[]',
  context_snapshot JSONB NOT NULL DEFAULT '{}',
  tool_schema_hash TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'replaced', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_summary TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Index for finding previous traces to replace
CREATE INDEX IF NOT EXISTS idx_traces_lookup ON q_execution_traces(entry_prompt_row_id, execution_type, owner_id, status);
CREATE INDEX IF NOT EXISTS idx_traces_owner ON q_execution_traces(owner_id);
CREATE INDEX IF NOT EXISTS idx_traces_status ON q_execution_traces(status) WHERE status = 'running';

-- RLS for q_execution_traces
ALTER TABLE q_execution_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own traces" ON q_execution_traces;
CREATE POLICY "Users can view own traces"
ON q_execution_traces FOR SELECT
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own traces" ON q_execution_traces;
CREATE POLICY "Users can insert own traces"
ON q_execution_traces FOR INSERT
WITH CHECK (current_user_has_allowed_domain() AND owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own traces" ON q_execution_traces;
CREATE POLICY "Users can update own traces"
ON q_execution_traces FOR UPDATE
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own traces" ON q_execution_traces;
CREATE POLICY "Users can delete own traces"
ON q_execution_traces FOR DELETE
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

-- ============================================================================
-- 2.9 Create q_execution_spans table
-- ============================================================================
CREATE TABLE IF NOT EXISTS q_execution_spans (
  span_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL REFERENCES q_execution_traces(trace_id) ON DELETE CASCADE,
  parent_span_id UUID REFERENCES q_execution_spans(span_id) ON DELETE SET NULL,
  prompt_row_id UUID REFERENCES q_prompts(row_id) ON DELETE SET NULL,
  span_type TEXT NOT NULL CHECK (span_type IN ('generation', 'retry', 'tool_call', 'action', 'error')),
  sequence_order INTEGER NOT NULL,
  openai_response_id TEXT,
  input_hash TEXT,
  output_preview TEXT,
  output_artefact_id UUID,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  previous_attempt_span_id UUID REFERENCES q_execution_spans(span_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
  error_evidence JSONB,
  latency_ms INTEGER,
  usage_tokens JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_spans_trace ON q_execution_spans(trace_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_spans_response_id ON q_execution_spans(openai_response_id) WHERE openai_response_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_spans_prompt ON q_execution_spans(prompt_row_id);

-- RLS via parent trace
ALTER TABLE q_execution_spans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view spans of own traces" ON q_execution_spans;
CREATE POLICY "Users can view spans of own traces"
ON q_execution_spans FOR SELECT
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM q_execution_traces t 
      WHERE t.trace_id = q_execution_spans.trace_id 
      AND t.owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can insert spans to own traces" ON q_execution_spans;
CREATE POLICY "Users can insert spans to own traces"
ON q_execution_spans FOR INSERT
WITH CHECK (
  current_user_has_allowed_domain() AND
  EXISTS (
    SELECT 1 FROM q_execution_traces t 
    WHERE t.trace_id = q_execution_spans.trace_id 
    AND t.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update spans of own traces" ON q_execution_spans;
CREATE POLICY "Users can update spans of own traces"
ON q_execution_spans FOR UPDATE
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM q_execution_traces t 
      WHERE t.trace_id = q_execution_spans.trace_id 
      AND t.owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can delete spans of own traces" ON q_execution_spans;
CREATE POLICY "Users can delete spans of own traces"
ON q_execution_spans FOR DELETE
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM q_execution_traces t 
      WHERE t.trace_id = q_execution_spans.trace_id 
      AND t.owner_id = auth.uid()
    )
  )
);

-- ============================================================================
-- 2.10 Create q_execution_artefacts table
-- ============================================================================
CREATE TABLE IF NOT EXISTS q_execution_artefacts (
  artefact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  span_id UUID NOT NULL REFERENCES q_execution_spans(span_id) ON DELETE CASCADE,
  artefact_type TEXT NOT NULL CHECK (artefact_type IN ('output', 'error_trace', 'tool_result', 'context')),
  content_hash TEXT NOT NULL,
  content TEXT NOT NULL,
  size_bytes INTEGER GENERATED ALWAYS AS (octet_length(content)) STORED,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Size limit: 1MB per artefact
  CONSTRAINT artefact_size_limit CHECK (octet_length(content) <= 1048576)
);

CREATE INDEX IF NOT EXISTS idx_artefacts_span ON q_execution_artefacts(span_id);
CREATE INDEX IF NOT EXISTS idx_artefacts_hash ON q_execution_artefacts(content_hash);

-- RLS via parent span -> trace
ALTER TABLE q_execution_artefacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view artefacts of own traces" ON q_execution_artefacts;
CREATE POLICY "Users can view artefacts of own traces"
ON q_execution_artefacts FOR SELECT
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM q_execution_spans s
      JOIN q_execution_traces t ON t.trace_id = s.trace_id
      WHERE s.span_id = q_execution_artefacts.span_id
      AND t.owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can insert artefacts to own traces" ON q_execution_artefacts;
CREATE POLICY "Users can insert artefacts to own traces"
ON q_execution_artefacts FOR INSERT
WITH CHECK (
  current_user_has_allowed_domain() AND
  EXISTS (
    SELECT 1 FROM q_execution_spans s
    JOIN q_execution_traces t ON t.trace_id = s.trace_id
    WHERE s.span_id = q_execution_artefacts.span_id
    AND t.owner_id = auth.uid()
  )
);

-- ============================================================================
-- 2.11 Create q_rate_limits table for rate limiting
-- ============================================================================
CREATE TABLE IF NOT EXISTS q_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON q_rate_limits(user_id, endpoint, window_start);

-- RLS for rate limits (users can only see/modify their own)
ALTER TABLE q_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own rate limits" ON q_rate_limits;
CREATE POLICY "Users can view own rate limits"
ON q_rate_limits FOR SELECT
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own rate limits" ON q_rate_limits;
CREATE POLICY "Users can insert own rate limits"
ON q_rate_limits FOR INSERT
WITH CHECK (current_user_has_allowed_domain() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own rate limits" ON q_rate_limits;
CREATE POLICY "Users can update own rate limits"
ON q_rate_limits FOR UPDATE
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR user_id = auth.uid()));

-- ============================================================================
-- 2.12 Cleanup function for old rate limit entries
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM q_rate_limits WHERE window_start < now() - interval '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2.13 Function to clean up orphaned running traces (after 30 min timeout)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_orphaned_traces()
RETURNS void AS $$
BEGIN
  UPDATE q_execution_traces
  SET status = 'failed',
      error_summary = 'Execution timed out after 30 minutes',
      completed_at = now()
  WHERE status = 'running'
    AND started_at < now() - interval '30 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;