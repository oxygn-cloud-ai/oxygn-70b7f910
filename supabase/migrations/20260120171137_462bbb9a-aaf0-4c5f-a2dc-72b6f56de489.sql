-- Phase 1.1: Create q_prompt_versions table
CREATE TABLE public.q_prompt_versions (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_row_id UUID NOT NULL REFERENCES public.q_prompts(row_id) ON DELETE CASCADE,
  
  -- Version metadata
  version_number INTEGER NOT NULL,
  commit_message TEXT,
  commit_type TEXT DEFAULT 'manual' CHECK (commit_type IN ('manual', 'auto', 'rollback', 'import')),
  
  -- Full state snapshot with schema version for future migrations
  snapshot JSONB NOT NULL,
  snapshot_schema_version INTEGER DEFAULT 1,
  
  -- Change tracking
  fields_changed TEXT[] DEFAULT '{}',
  parent_version_id UUID REFERENCES public.q_prompt_versions(row_id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Tagging and organization
  tag_name TEXT,
  is_pinned BOOLEAN DEFAULT false,
  
  -- Constraints
  CONSTRAINT unique_prompt_version UNIQUE (prompt_row_id, version_number)
);

-- Partial unique index for tags (only enforces uniqueness on non-null tags)
CREATE UNIQUE INDEX idx_unique_prompt_tag 
ON public.q_prompt_versions(prompt_row_id, tag_name) 
WHERE tag_name IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_prompt_versions_prompt ON public.q_prompt_versions(prompt_row_id);
CREATE INDEX idx_prompt_versions_created ON public.q_prompt_versions(created_at DESC);
CREATE INDEX idx_prompt_versions_tag ON public.q_prompt_versions(tag_name) WHERE tag_name IS NOT NULL;

-- Phase 1.2: Add version tracking columns to q_prompts
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_uncommitted_changes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_committed_at TIMESTAMPTZ;

-- Create index for uncommitted queries
CREATE INDEX idx_prompts_uncommitted 
ON public.q_prompts(has_uncommitted_changes) 
WHERE has_uncommitted_changes = true AND is_deleted = false;

-- Phase 1.3: RLS Policies
ALTER TABLE public.q_prompt_versions ENABLE ROW LEVEL SECURITY;

-- Read: Domain users can read versions for prompts they own, are shared with, or are admin
CREATE POLICY "read_prompt_versions"
ON public.q_prompt_versions FOR SELECT
USING (
  public.current_user_has_allowed_domain() 
  AND (
    -- Admin access
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    -- Owner access
    OR EXISTS (
      SELECT 1 FROM public.q_prompts 
      WHERE row_id = prompt_row_id 
      AND owner_id = auth.uid()
      AND is_deleted = false
    )
    -- Shared access (if resource_shares table exists)
    OR EXISTS (
      SELECT 1 FROM public.resource_shares rs
      JOIN public.q_prompts p ON p.row_id = prompt_row_id
      WHERE rs.resource_type = 'prompt'
      AND rs.resource_id = p.row_id
      AND rs.shared_with_user_id = auth.uid()
    )
  )
);

-- Insert: Only prompt owner or admin can create versions
CREATE POLICY "insert_prompt_versions"
ON public.q_prompt_versions FOR INSERT
WITH CHECK (
  public.current_user_has_allowed_domain()
  AND created_by = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.q_prompts 
      WHERE row_id = prompt_row_id 
      AND owner_id = auth.uid()
      AND is_deleted = false
    )
  )
);

-- Update: Owner/admin can update only tag_name and is_pinned
CREATE POLICY "update_prompt_versions"
ON public.q_prompt_versions FOR UPDATE
USING (
  public.current_user_has_allowed_domain()
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.q_prompts 
      WHERE row_id = prompt_row_id 
      AND owner_id = auth.uid()
    )
  )
);

-- Delete: Only admin can delete versions
CREATE POLICY "delete_prompt_versions"
ON public.q_prompt_versions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Phase 1.4: Database Functions

-- Helper: Check if user can version this prompt
CREATE OR REPLACE FUNCTION public.can_version_prompt(p_prompt_row_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.q_prompts 
    WHERE row_id = p_prompt_row_id 
    AND owner_id = p_user_id
    AND is_deleted = false
  );
$$;

-- Helper: Build complete version snapshot
CREATE OR REPLACE FUNCTION public.build_prompt_snapshot(p_prompt q_prompts)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN jsonb_build_object(
    -- Content fields
    'prompt_name', p_prompt.prompt_name,
    'input_admin_prompt', p_prompt.input_admin_prompt,
    'input_user_prompt', p_prompt.input_user_prompt,
    'note', p_prompt.note,
    
    -- Model configuration
    'model', p_prompt.model,
    'model_on', p_prompt.model_on,
    'temperature', p_prompt.temperature,
    'temperature_on', p_prompt.temperature_on,
    'top_p', p_prompt.top_p,
    'top_p_on', p_prompt.top_p_on,
    'max_tokens', p_prompt.max_tokens,
    'max_tokens_on', p_prompt.max_tokens_on,
    'max_output_tokens', p_prompt.max_output_tokens,
    'max_output_tokens_on', p_prompt.max_output_tokens_on,
    'max_completion_tokens', p_prompt.max_completion_tokens,
    'max_completion_tokens_on', p_prompt.max_completion_tokens_on,
    'frequency_penalty', p_prompt.frequency_penalty,
    'frequency_penalty_on', p_prompt.frequency_penalty_on,
    'presence_penalty', p_prompt.presence_penalty,
    'presence_penalty_on', p_prompt.presence_penalty_on,
    'reasoning_effort', p_prompt.reasoning_effort,
    'reasoning_effort_on', p_prompt.reasoning_effort_on,
    'response_format', p_prompt.response_format,
    'response_format_on', p_prompt.response_format_on,
    'stop', p_prompt.stop,
    'stop_on', p_prompt.stop_on,
    'seed', p_prompt.seed,
    'seed_on', p_prompt.seed_on,
    
    -- Node configuration
    'node_type', p_prompt.node_type,
    'post_action', p_prompt.post_action,
    'post_action_config', p_prompt.post_action_config,
    'question_config', p_prompt.question_config,
    'json_schema_template_id', p_prompt.json_schema_template_id,
    'variable_assignments_config', p_prompt.variable_assignments_config,
    'extracted_variables', p_prompt.extracted_variables,
    
    -- Behavior settings
    'auto_run_children', p_prompt.auto_run_children,
    'exclude_from_cascade', p_prompt.exclude_from_cascade,
    'exclude_from_export', p_prompt.exclude_from_export,
    'child_thread_strategy', p_prompt.child_thread_strategy,
    'default_child_thread_strategy', p_prompt.default_child_thread_strategy,
    'thread_mode', p_prompt.thread_mode,
    'task_mode', p_prompt.task_mode,
    
    -- Tool settings
    'code_interpreter_on', p_prompt.code_interpreter_on,
    'file_search_on', p_prompt.file_search_on,
    'web_search_on', p_prompt.web_search_on,
    'confluence_enabled', p_prompt.confluence_enabled,
    'tool_choice', p_prompt.tool_choice,
    'tool_choice_on', p_prompt.tool_choice_on,
    
    -- Additional fields
    'is_legacy', p_prompt.is_legacy
  );
END;
$$;

-- Helper: Calculate changed fields between two snapshots
CREATE OR REPLACE FUNCTION public.calculate_changed_fields(
  p_old_snapshot JSONB,
  p_new_snapshot JSONB
)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_changed TEXT[] := '{}';
  v_key TEXT;
BEGIN
  IF p_old_snapshot IS NULL THEN
    SELECT array_agg(key) INTO v_changed FROM jsonb_object_keys(p_new_snapshot) AS key;
    RETURN COALESCE(v_changed, '{}');
  END IF;
  
  FOR v_key IN SELECT jsonb_object_keys(p_new_snapshot)
  LOOP
    IF (p_new_snapshot -> v_key) IS DISTINCT FROM (p_old_snapshot -> v_key) THEN
      v_changed := array_append(v_changed, v_key);
    END IF;
  END LOOP;
  
  RETURN v_changed;
END;
$$;

-- Main function: Create a version snapshot
CREATE OR REPLACE FUNCTION public.create_prompt_version(
  p_prompt_row_id UUID,
  p_commit_message TEXT DEFAULT NULL,
  p_commit_type TEXT DEFAULT 'manual',
  p_tag_name TEXT DEFAULT NULL
)
RETURNS TABLE(version_id UUID, version_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prompt q_prompts;
  v_version_number INTEGER;
  v_snapshot JSONB;
  v_fields_changed TEXT[];
  v_prev_snapshot JSONB;
  v_prev_version_id UUID;
  v_version_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF NOT public.can_version_prompt(p_prompt_row_id, v_user_id) THEN
    RAISE EXCEPTION 'Not authorized to version this prompt';
  END IF;
  
  -- Lock and fetch prompt row
  SELECT * INTO v_prompt 
  FROM q_prompts 
  WHERE row_id = p_prompt_row_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prompt not found: %', p_prompt_row_id;
  END IF;
  
  IF v_prompt.is_deleted = true THEN
    RAISE EXCEPTION 'Cannot version a deleted prompt';
  END IF;
  
  -- Get next version number with lock
  SELECT COALESCE(MAX(pv.version_number), 0) + 1
  INTO v_version_number
  FROM q_prompt_versions pv
  WHERE pv.prompt_row_id = p_prompt_row_id
  FOR UPDATE;
  
  -- Get previous version for diff
  SELECT pv.row_id, pv.snapshot 
  INTO v_prev_version_id, v_prev_snapshot
  FROM q_prompt_versions pv
  WHERE pv.prompt_row_id = p_prompt_row_id 
  ORDER BY pv.version_number DESC 
  LIMIT 1;
  
  -- Build snapshot
  v_snapshot := public.build_prompt_snapshot(v_prompt);
  
  -- Calculate changed fields
  v_fields_changed := public.calculate_changed_fields(v_prev_snapshot, v_snapshot);
  
  -- Validate tag uniqueness
  IF p_tag_name IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM q_prompt_versions 
      WHERE prompt_row_id = p_prompt_row_id AND tag_name = p_tag_name
    ) THEN
      RAISE EXCEPTION 'Tag "%" already exists for this prompt', p_tag_name;
    END IF;
  END IF;
  
  -- Insert version record
  INSERT INTO q_prompt_versions (
    prompt_row_id, version_number, commit_message, commit_type,
    snapshot, snapshot_schema_version, fields_changed, 
    parent_version_id, tag_name, created_by
  ) VALUES (
    p_prompt_row_id, v_version_number, p_commit_message, p_commit_type,
    v_snapshot, 1, v_fields_changed, 
    v_prev_version_id, p_tag_name, v_user_id
  ) RETURNING row_id INTO v_version_id;
  
  -- Update prompt tracking fields
  UPDATE q_prompts SET 
    current_version = v_version_number,
    has_uncommitted_changes = false,
    last_committed_at = now()
  WHERE row_id = p_prompt_row_id;
  
  RETURN QUERY SELECT v_version_id, v_version_number;
END;
$$;

-- Function: Rollback to a specific version
CREATE OR REPLACE FUNCTION public.rollback_prompt_version(
  p_prompt_row_id UUID,
  p_target_version_id UUID,
  p_create_backup BOOLEAN DEFAULT true
)
RETURNS TABLE(backup_version_id UUID, restored_version_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_version q_prompt_versions;
  v_snapshot JSONB;
  v_backup_result RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF NOT public.can_version_prompt(p_prompt_row_id, v_user_id) THEN
    RAISE EXCEPTION 'Not authorized to rollback this prompt';
  END IF;
  
  -- Lock prompt row
  PERFORM 1 FROM q_prompts WHERE row_id = p_prompt_row_id FOR UPDATE;
  
  -- Get target version
  SELECT * INTO v_target_version 
  FROM q_prompt_versions 
  WHERE row_id = p_target_version_id AND prompt_row_id = p_prompt_row_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found or does not belong to this prompt';
  END IF;
  
  -- Create backup if requested
  IF p_create_backup THEN
    SELECT * INTO v_backup_result FROM public.create_prompt_version(
      p_prompt_row_id,
      'Auto-backup before rollback to v' || v_target_version.version_number,
      'rollback'
    );
  END IF;
  
  v_snapshot := v_target_version.snapshot;
  
  -- Apply snapshot with proper type handling
  UPDATE q_prompts SET
    -- Content fields (TEXT)
    prompt_name = v_snapshot->>'prompt_name',
    input_admin_prompt = v_snapshot->>'input_admin_prompt',
    input_user_prompt = v_snapshot->>'input_user_prompt',
    note = v_snapshot->>'note',
    
    -- Model configuration (TEXT + BOOLEAN)
    model = v_snapshot->>'model',
    model_on = (v_snapshot->>'model_on')::boolean,
    temperature = v_snapshot->>'temperature',
    temperature_on = (v_snapshot->>'temperature_on')::boolean,
    top_p = v_snapshot->>'top_p',
    top_p_on = (v_snapshot->>'top_p_on')::boolean,
    max_tokens = v_snapshot->>'max_tokens',
    max_tokens_on = (v_snapshot->>'max_tokens_on')::boolean,
    max_output_tokens = v_snapshot->>'max_output_tokens',
    max_output_tokens_on = (v_snapshot->>'max_output_tokens_on')::boolean,
    max_completion_tokens = v_snapshot->>'max_completion_tokens',
    max_completion_tokens_on = (v_snapshot->>'max_completion_tokens_on')::boolean,
    frequency_penalty = v_snapshot->>'frequency_penalty',
    frequency_penalty_on = (v_snapshot->>'frequency_penalty_on')::boolean,
    presence_penalty = v_snapshot->>'presence_penalty',
    presence_penalty_on = (v_snapshot->>'presence_penalty_on')::boolean,
    reasoning_effort = v_snapshot->>'reasoning_effort',
    reasoning_effort_on = (v_snapshot->>'reasoning_effort_on')::boolean,
    response_format = v_snapshot->>'response_format',
    response_format_on = (v_snapshot->>'response_format_on')::boolean,
    stop = v_snapshot->>'stop',
    stop_on = (v_snapshot->>'stop_on')::boolean,
    seed = v_snapshot->>'seed',
    seed_on = (v_snapshot->>'seed_on')::boolean,
    
    -- Node configuration (TEXT + JSONB + UUID)
    node_type = v_snapshot->>'node_type',
    post_action = v_snapshot->>'post_action',
    post_action_config = CASE 
      WHEN v_snapshot->'post_action_config' IS NULL OR v_snapshot->'post_action_config' = 'null'::jsonb 
      THEN NULL ELSE v_snapshot->'post_action_config' END,
    question_config = CASE 
      WHEN v_snapshot->'question_config' IS NULL OR v_snapshot->'question_config' = 'null'::jsonb 
      THEN NULL ELSE v_snapshot->'question_config' END,
    json_schema_template_id = CASE 
      WHEN v_snapshot->>'json_schema_template_id' IS NULL OR v_snapshot->>'json_schema_template_id' = 'null' 
      THEN NULL ELSE (v_snapshot->>'json_schema_template_id')::uuid END,
    variable_assignments_config = CASE 
      WHEN v_snapshot->'variable_assignments_config' IS NULL OR v_snapshot->'variable_assignments_config' = 'null'::jsonb 
      THEN NULL ELSE v_snapshot->'variable_assignments_config' END,
    extracted_variables = CASE 
      WHEN v_snapshot->'extracted_variables' IS NULL OR v_snapshot->'extracted_variables' = 'null'::jsonb 
      THEN NULL ELSE v_snapshot->'extracted_variables' END,
    
    -- Behavior settings (BOOLEAN + TEXT)
    auto_run_children = (v_snapshot->>'auto_run_children')::boolean,
    exclude_from_cascade = (v_snapshot->>'exclude_from_cascade')::boolean,
    exclude_from_export = (v_snapshot->>'exclude_from_export')::boolean,
    child_thread_strategy = v_snapshot->>'child_thread_strategy',
    default_child_thread_strategy = v_snapshot->>'default_child_thread_strategy',
    thread_mode = v_snapshot->>'thread_mode',
    task_mode = v_snapshot->>'task_mode',
    
    -- Tool settings (BOOLEAN + TEXT)
    code_interpreter_on = (v_snapshot->>'code_interpreter_on')::boolean,
    file_search_on = (v_snapshot->>'file_search_on')::boolean,
    web_search_on = (v_snapshot->>'web_search_on')::boolean,
    confluence_enabled = (v_snapshot->>'confluence_enabled')::boolean,
    tool_choice = v_snapshot->>'tool_choice',
    tool_choice_on = (v_snapshot->>'tool_choice_on')::boolean,
    
    -- Additional fields
    is_legacy = (v_snapshot->>'is_legacy')::boolean,
    
    -- Update tracking
    has_uncommitted_changes = false,
    updated_at = now()
  WHERE row_id = p_prompt_row_id;
  
  RETURN QUERY SELECT v_backup_result.version_id, v_target_version.version_number;
END;
$$;

-- Cleanup function for old versions
CREATE OR REPLACE FUNCTION public.cleanup_old_prompt_versions(
  p_max_age_days INTEGER DEFAULT 90,
  p_min_versions_to_keep INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required for cleanup';
  END IF;

  WITH versions_to_delete AS (
    SELECT v.row_id
    FROM q_prompt_versions v
    WHERE v.created_at < now() - (p_max_age_days || ' days')::interval
      AND v.is_pinned = false
      AND v.tag_name IS NULL
      AND v.version_number NOT IN (
        SELECT v2.version_number 
        FROM q_prompt_versions v2
        WHERE v2.prompt_row_id = v.prompt_row_id 
        ORDER BY v2.version_number DESC 
        LIMIT p_min_versions_to_keep
      )
  )
  DELETE FROM q_prompt_versions 
  WHERE row_id IN (SELECT row_id FROM versions_to_delete);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- Phase 1.5: Uncommitted Changes Trigger
CREATE OR REPLACE FUNCTION public.mark_prompt_uncommitted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_versionable_fields TEXT[] := ARRAY[
    -- Content
    'prompt_name', 'input_admin_prompt', 'input_user_prompt', 'note',
    -- Model config
    'model', 'model_on', 'temperature', 'temperature_on', 
    'top_p', 'top_p_on', 'max_tokens', 'max_tokens_on',
    'max_output_tokens', 'max_output_tokens_on', 
    'max_completion_tokens', 'max_completion_tokens_on',
    'frequency_penalty', 'frequency_penalty_on', 
    'presence_penalty', 'presence_penalty_on',
    'reasoning_effort', 'reasoning_effort_on',
    'response_format', 'response_format_on',
    'stop', 'stop_on', 'seed', 'seed_on',
    -- Node config
    'node_type', 'post_action', 'post_action_config',
    'question_config', 'json_schema_template_id',
    'variable_assignments_config', 'extracted_variables',
    -- Behavior
    'auto_run_children', 'exclude_from_cascade', 'exclude_from_export',
    'child_thread_strategy', 'default_child_thread_strategy',
    'thread_mode', 'task_mode',
    -- Tools
    'code_interpreter_on', 'file_search_on', 'web_search_on',
    'confluence_enabled', 'tool_choice', 'tool_choice_on',
    -- Additional
    'is_legacy'
  ];
  v_field TEXT;
  v_old_val JSONB;
  v_new_val JSONB;
BEGIN
  -- Skip if already marked
  IF NEW.has_uncommitted_changes = true THEN
    RETURN NEW;
  END IF;
  
  -- Check versionable fields
  FOREACH v_field IN ARRAY v_versionable_fields LOOP
    v_old_val := to_jsonb(OLD) -> v_field;
    v_new_val := to_jsonb(NEW) -> v_field;
    
    IF v_new_val IS DISTINCT FROM v_old_val THEN
      NEW.has_uncommitted_changes := true;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_prompt_uncommitted ON public.q_prompts;

CREATE TRIGGER trg_mark_prompt_uncommitted
BEFORE UPDATE ON public.q_prompts
FOR EACH ROW
WHEN (OLD.is_deleted = false)
EXECUTE FUNCTION public.mark_prompt_uncommitted();