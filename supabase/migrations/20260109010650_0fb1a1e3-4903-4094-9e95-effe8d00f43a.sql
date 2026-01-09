-- Phase 0: Database Pre-Requisites

-- 0.1 Create Realtime Publication if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- 0.2 Add Unique Constraint to q_settings (for webhook_id storage)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_setting_key'
  ) THEN
    ALTER TABLE q_settings ADD CONSTRAINT unique_setting_key UNIQUE (setting_key);
  END IF;
END
$$;

-- Phase 1.1: Extend q_models for Multi-Provider Support
ALTER TABLE q_models 
ADD COLUMN IF NOT EXISTS api_base_url TEXT,
ADD COLUMN IF NOT EXISTS auth_header_name TEXT DEFAULT 'Authorization',
ADD COLUMN IF NOT EXISTS auth_header_format TEXT DEFAULT 'Bearer {key}';

UPDATE q_models 
SET api_base_url = 'https://api.openai.com/v1',
    auth_header_name = 'Authorization',
    auth_header_format = 'Bearer {key}'
WHERE (provider = 'openai' OR provider IS NULL) AND api_base_url IS NULL;

-- Phase 1.2: Fix q_threads for Multi-Provider
ALTER TABLE q_threads 
ALTER COLUMN openai_conversation_id DROP NOT NULL;

ALTER TABLE q_threads 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS external_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_threads_provider 
ON q_threads(root_prompt_row_id, owner_id, provider, is_active);

-- Phase 1.3: Create q_manus_tasks Table
CREATE TABLE IF NOT EXISTS q_manus_tasks (
  task_id TEXT PRIMARY KEY,
  trace_id UUID REFERENCES q_execution_traces(trace_id) ON DELETE SET NULL,
  prompt_row_id UUID REFERENCES q_prompts(row_id) ON DELETE SET NULL,
  owner_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'running', 'completed', 'failed', 'cancelled')),
  task_title TEXT,
  task_url TEXT,
  result_message TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  stop_reason TEXT,
  requires_input BOOLEAN DEFAULT false,
  input_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  webhook_event_id TEXT UNIQUE
);

-- Enable Realtime for q_manus_tasks
ALTER TABLE q_manus_tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE q_manus_tasks;

-- RLS Policies for q_manus_tasks
ALTER TABLE q_manus_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own manus tasks" ON q_manus_tasks
  FOR SELECT USING (
    current_user_has_allowed_domain() AND 
    (is_admin(auth.uid()) OR owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own manus tasks" ON q_manus_tasks
  FOR INSERT WITH CHECK (
    current_user_has_allowed_domain() AND owner_id = auth.uid()
  );

CREATE POLICY "Users can update own manus tasks" ON q_manus_tasks
  FOR UPDATE USING (
    current_user_has_allowed_domain() AND 
    (is_admin(auth.uid()) OR owner_id = auth.uid())
  );

CREATE POLICY "Users can delete own manus tasks" ON q_manus_tasks
  FOR DELETE USING (
    current_user_has_allowed_domain() AND 
    (is_admin(auth.uid()) OR owner_id = auth.uid())
  );

-- Indexes for q_manus_tasks
CREATE INDEX IF NOT EXISTS idx_manus_tasks_owner_status ON q_manus_tasks(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_manus_tasks_pending_cleanup ON q_manus_tasks(status, created_at) WHERE status IN ('pending', 'created', 'running');

-- Phase 1.4: Add Provider Lock and Task Mode to Prompts
ALTER TABLE q_prompts 
ADD COLUMN IF NOT EXISTS provider_lock TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS task_mode TEXT DEFAULT 'adaptive';

-- Phase 1.5: Insert Manus Models
INSERT INTO q_models (
  model_id, model_name, provider, is_active,
  api_model_id, api_base_url, auth_header_name, auth_header_format,
  context_window, max_output_tokens,
  supports_temperature, supports_reasoning_effort,
  supported_settings, supported_tools
) VALUES 
('manus-chat', 'Manus Chat', 'manus', true,
 'manus-1.6', 'https://api.manus.ai', 'API_KEY', '{key}',
 1000000, 100000, false, false,
 ARRAY['task_mode']::text[], ARRAY[]::text[]),
('manus-adaptive', 'Manus Adaptive', 'manus', true,
 'manus-1.6', 'https://api.manus.ai', 'API_KEY', '{key}',
 1000000, 100000, false, false,
 ARRAY['task_mode']::text[], ARRAY[]::text[]),
('manus-agent', 'Manus Agent', 'manus', true,
 'manus-1.6', 'https://api.manus.ai', 'API_KEY', '{key}',
 1000000, 100000, false, false,
 ARRAY['task_mode']::text[], ARRAY[]::text[])
ON CONFLICT (model_id) DO NOTHING;

-- Phase 1.6: Add Orphaned Task Cleanup Function
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_manus_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE q_manus_tasks
  SET status = 'failed',
      stop_reason = 'Orphaned task cleaned up after 2 hours',
      completed_at = now()
  WHERE status IN ('pending', 'created', 'running')
    AND created_at < now() - interval '2 hours';
END;
$$;