-- Table to track long-running OpenAI responses awaiting webhook completion
-- Follows same pattern as q_manus_tasks
CREATE TABLE q_pending_responses (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  prompt_row_id UUID REFERENCES q_prompts(row_id),
  thread_row_id UUID REFERENCES q_threads(row_id),
  trace_id UUID REFERENCES q_execution_traces(trace_id),
  
  -- Source function tracking
  source_function TEXT NOT NULL DEFAULT 'conversation-run',
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  output_text TEXT,
  error TEXT,
  error_code TEXT,
  
  -- Context for resumption
  model TEXT,
  reasoning_effort TEXT,
  request_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  webhook_event_id TEXT,
  
  -- Constraints
  CONSTRAINT valid_pending_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'incomplete')),
  CONSTRAINT valid_pending_source CHECK (source_function IN ('conversation-run', 'prompt-family-chat'))
);

-- Indexes for efficient lookups
CREATE INDEX idx_pending_responses_response_id ON q_pending_responses(response_id);
CREATE INDEX idx_pending_responses_owner_status ON q_pending_responses(owner_id, status);
CREATE INDEX idx_pending_responses_created_at ON q_pending_responses(created_at);

-- CRITICAL: Enable Realtime with full replica identity for UPDATE events
ALTER TABLE q_pending_responses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE q_pending_responses;

-- RLS policies (same pattern as q_manus_tasks)
ALTER TABLE q_pending_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pending responses" ON q_pending_responses
  FOR SELECT USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

CREATE POLICY "Users can insert own pending responses" ON q_pending_responses
  FOR INSERT WITH CHECK (current_user_has_allowed_domain() AND owner_id = auth.uid());

CREATE POLICY "Users can update own pending responses" ON q_pending_responses
  FOR UPDATE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

CREATE POLICY "Users can delete own pending responses" ON q_pending_responses
  FOR DELETE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

-- Cleanup orphaned pending responses (matching cleanup_orphaned_manus_tasks pattern)
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_pending_responses()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE q_pending_responses
  SET status = 'failed',
      error = 'Orphaned request cleaned up after 2 hours',
      completed_at = now()
  WHERE status = 'pending'
    AND created_at < now() - interval '2 hours';
END;
$function$;

-- Cleanup old completed/failed pending responses (data retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_pending_responses()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM q_pending_responses
  WHERE completed_at < now() - interval '30 days'
    AND status IN ('completed', 'failed', 'cancelled', 'incomplete');
END;
$function$;