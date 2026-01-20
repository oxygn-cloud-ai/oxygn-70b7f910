-- =====================================================
-- CORRECTIVE MIGRATION: Fix Version History Functions
-- Uses concatenation to avoid 100-argument limit
-- =====================================================

-- 1. REPLACE build_prompt_snapshot using concatenation to avoid 100-arg limit
CREATE OR REPLACE FUNCTION public.build_prompt_snapshot(p_prompt q_prompts)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Part 1: Content and core model config
  v_result := jsonb_build_object(
    'prompt_name', p_prompt.prompt_name,
    'input_admin_prompt', p_prompt.input_admin_prompt,
    'input_user_prompt', p_prompt.input_user_prompt,
    'note', p_prompt.note,
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
    'seed_on', p_prompt.seed_on
  );

  -- Part 2: Additional model config
  v_result := v_result || jsonb_build_object(
    'n', p_prompt.n,
    'n_on', p_prompt.n_on,
    'logit_bias', p_prompt.logit_bias,
    'logit_bias_on', p_prompt.logit_bias_on,
    'o_user', p_prompt.o_user,
    'o_user_on', p_prompt.o_user_on,
    'stream', p_prompt.stream,
    'stream_on', p_prompt.stream_on,
    'best_of', p_prompt.best_of,
    'best_of_on', p_prompt.best_of_on,
    'logprobs', p_prompt.logprobs,
    'logprobs_on', p_prompt.logprobs_on,
    'echo', p_prompt.echo,
    'echo_on', p_prompt.echo_on,
    'suffix', p_prompt.suffix,
    'suffix_on', p_prompt.suffix_on,
    'context_length', p_prompt.context_length,
    'context_length_on', p_prompt.context_length_on
  );

  -- Part 3: Node config and behavior
  v_result := v_result || jsonb_build_object(
    'node_type', p_prompt.node_type,
    'post_action', p_prompt.post_action,
    'post_action_config', p_prompt.post_action_config,
    'question_config', p_prompt.question_config,
    'json_schema_template_id', p_prompt.json_schema_template_id,
    'variable_assignments_config', p_prompt.variable_assignments_config,
    'extracted_variables', p_prompt.extracted_variables,
    'auto_run_children', p_prompt.auto_run_children,
    'exclude_from_cascade', p_prompt.exclude_from_cascade,
    'exclude_from_export', p_prompt.exclude_from_export,
    'child_thread_strategy', p_prompt.child_thread_strategy,
    'default_child_thread_strategy', p_prompt.default_child_thread_strategy,
    'thread_mode', p_prompt.thread_mode,
    'task_mode', p_prompt.task_mode
  );

  -- Part 4: Tools, visual, and references
  v_result := v_result || jsonb_build_object(
    'code_interpreter_on', p_prompt.code_interpreter_on,
    'file_search_on', p_prompt.file_search_on,
    'web_search_on', p_prompt.web_search_on,
    'confluence_enabled', p_prompt.confluence_enabled,
    'tool_choice', p_prompt.tool_choice,
    'tool_choice_on', p_prompt.tool_choice_on,
    'icon_name', p_prompt.icon_name,
    'starred', p_prompt.starred,
    'is_private', p_prompt.is_private,
    'is_assistant', p_prompt.is_assistant,
    'is_legacy', p_prompt.is_legacy,
    'system_variables', p_prompt.system_variables,
    'template_row_id', p_prompt.template_row_id,
    'library_prompt_id', p_prompt.library_prompt_id,
    'provider_lock', p_prompt.provider_lock
  );

  RETURN v_result;
END;
$$;

-- 2. REPLACE rollback_prompt_version with ALL columns
CREATE OR REPLACE FUNCTION public.rollback_prompt_version(p_prompt_row_id uuid, p_target_version_id uuid, p_create_backup boolean DEFAULT true)
RETURNS TABLE(backup_version_id uuid, restored_version_number integer)
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
  
  PERFORM 1 FROM q_prompts WHERE row_id = p_prompt_row_id FOR UPDATE;
  
  SELECT * INTO v_target_version 
  FROM q_prompt_versions 
  WHERE row_id = p_target_version_id AND prompt_row_id = p_prompt_row_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found or does not belong to this prompt';
  END IF;
  
  IF p_create_backup THEN
    SELECT * INTO v_backup_result FROM public.create_prompt_version(
      p_prompt_row_id,
      'Auto-backup before rollback to v' || v_target_version.version_number,
      'rollback'
    );
  END IF;
  
  v_snapshot := v_target_version.snapshot;
  
  UPDATE q_prompts SET
    prompt_name = v_snapshot->>'prompt_name',
    input_admin_prompt = v_snapshot->>'input_admin_prompt',
    input_user_prompt = v_snapshot->>'input_user_prompt',
    note = v_snapshot->>'note',
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
    n = v_snapshot->>'n',
    n_on = (v_snapshot->>'n_on')::boolean,
    logit_bias = v_snapshot->>'logit_bias',
    logit_bias_on = (v_snapshot->>'logit_bias_on')::boolean,
    o_user = v_snapshot->>'o_user',
    o_user_on = (v_snapshot->>'o_user_on')::boolean,
    stream = (v_snapshot->>'stream')::boolean,
    stream_on = (v_snapshot->>'stream_on')::boolean,
    best_of = v_snapshot->>'best_of',
    best_of_on = (v_snapshot->>'best_of_on')::boolean,
    logprobs = v_snapshot->>'logprobs',
    logprobs_on = (v_snapshot->>'logprobs_on')::boolean,
    echo = (v_snapshot->>'echo')::boolean,
    echo_on = (v_snapshot->>'echo_on')::boolean,
    suffix = v_snapshot->>'suffix',
    suffix_on = (v_snapshot->>'suffix_on')::boolean,
    context_length = v_snapshot->>'context_length',
    context_length_on = (v_snapshot->>'context_length_on')::boolean,
    node_type = v_snapshot->>'node_type',
    post_action = v_snapshot->>'post_action',
    post_action_config = CASE WHEN v_snapshot->'post_action_config' IS NULL OR v_snapshot->'post_action_config' = 'null'::jsonb THEN NULL ELSE v_snapshot->'post_action_config' END,
    question_config = CASE WHEN v_snapshot->'question_config' IS NULL OR v_snapshot->'question_config' = 'null'::jsonb THEN NULL ELSE v_snapshot->'question_config' END,
    json_schema_template_id = CASE WHEN v_snapshot->>'json_schema_template_id' IS NULL OR v_snapshot->>'json_schema_template_id' = '' THEN NULL ELSE (v_snapshot->>'json_schema_template_id')::uuid END,
    variable_assignments_config = CASE WHEN v_snapshot->'variable_assignments_config' IS NULL OR v_snapshot->'variable_assignments_config' = 'null'::jsonb THEN NULL ELSE v_snapshot->'variable_assignments_config' END,
    extracted_variables = CASE WHEN v_snapshot->'extracted_variables' IS NULL OR v_snapshot->'extracted_variables' = 'null'::jsonb THEN NULL ELSE v_snapshot->'extracted_variables' END,
    auto_run_children = (v_snapshot->>'auto_run_children')::boolean,
    exclude_from_cascade = (v_snapshot->>'exclude_from_cascade')::boolean,
    exclude_from_export = (v_snapshot->>'exclude_from_export')::boolean,
    child_thread_strategy = v_snapshot->>'child_thread_strategy',
    default_child_thread_strategy = v_snapshot->>'default_child_thread_strategy',
    thread_mode = v_snapshot->>'thread_mode',
    task_mode = v_snapshot->>'task_mode',
    code_interpreter_on = (v_snapshot->>'code_interpreter_on')::boolean,
    file_search_on = (v_snapshot->>'file_search_on')::boolean,
    web_search_on = (v_snapshot->>'web_search_on')::boolean,
    confluence_enabled = (v_snapshot->>'confluence_enabled')::boolean,
    tool_choice = v_snapshot->>'tool_choice',
    tool_choice_on = (v_snapshot->>'tool_choice_on')::boolean,
    icon_name = v_snapshot->>'icon_name',
    starred = (v_snapshot->>'starred')::boolean,
    is_private = (v_snapshot->>'is_private')::boolean,
    is_assistant = (v_snapshot->>'is_assistant')::boolean,
    is_legacy = (v_snapshot->>'is_legacy')::boolean,
    system_variables = CASE WHEN v_snapshot->'system_variables' IS NULL OR v_snapshot->'system_variables' = 'null'::jsonb THEN NULL ELSE v_snapshot->'system_variables' END,
    template_row_id = CASE WHEN v_snapshot->>'template_row_id' IS NULL OR v_snapshot->>'template_row_id' = '' THEN NULL ELSE (v_snapshot->>'template_row_id')::uuid END,
    library_prompt_id = CASE WHEN v_snapshot->>'library_prompt_id' IS NULL OR v_snapshot->>'library_prompt_id' = '' THEN NULL ELSE (v_snapshot->>'library_prompt_id')::uuid END,
    provider_lock = v_snapshot->>'provider_lock',
    has_uncommitted_changes = false,
    updated_at = now()
  WHERE row_id = p_prompt_row_id;
  
  RETURN QUERY SELECT v_backup_result.version_id, v_target_version.version_number;
END;
$$;

-- 3. REPLACE mark_prompt_uncommitted trigger
CREATE OR REPLACE FUNCTION public.mark_prompt_uncommitted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_versionable_fields TEXT[] := ARRAY[
    'prompt_name', 'input_admin_prompt', 'input_user_prompt', 'note',
    'model', 'model_on', 'temperature', 'temperature_on', 
    'top_p', 'top_p_on', 'max_tokens', 'max_tokens_on',
    'max_output_tokens', 'max_output_tokens_on', 
    'max_completion_tokens', 'max_completion_tokens_on',
    'frequency_penalty', 'frequency_penalty_on', 
    'presence_penalty', 'presence_penalty_on',
    'reasoning_effort', 'reasoning_effort_on',
    'response_format', 'response_format_on',
    'stop', 'stop_on', 'seed', 'seed_on',
    'n', 'n_on', 'logit_bias', 'logit_bias_on', 
    'o_user', 'o_user_on', 'stream', 'stream_on',
    'best_of', 'best_of_on', 'logprobs', 'logprobs_on',
    'echo', 'echo_on', 'suffix', 'suffix_on',
    'context_length', 'context_length_on',
    'node_type', 'post_action', 'post_action_config',
    'question_config', 'json_schema_template_id',
    'variable_assignments_config', 'extracted_variables',
    'auto_run_children', 'exclude_from_cascade', 'exclude_from_export',
    'child_thread_strategy', 'default_child_thread_strategy',
    'thread_mode', 'task_mode',
    'code_interpreter_on', 'file_search_on', 'web_search_on',
    'confluence_enabled', 'tool_choice', 'tool_choice_on',
    'icon_name', 'starred', 'is_private', 'is_assistant', 'is_legacy',
    'system_variables', 'template_row_id', 'library_prompt_id', 'provider_lock'
  ];
  v_field TEXT;
  v_old_val JSONB;
  v_new_val JSONB;
BEGIN
  IF NEW.has_uncommitted_changes = true THEN
    RETURN NEW;
  END IF;
  
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

-- 4. FIX can_version_prompt to include resource_shares
CREATE OR REPLACE FUNCTION public.can_version_prompt(p_prompt_row_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.q_prompts WHERE row_id = p_prompt_row_id AND owner_id = p_user_id AND is_deleted = false)
    OR EXISTS (
      SELECT 1 FROM public.resource_shares rs
      WHERE rs.resource_type = 'prompt' AND rs.resource_id = p_prompt_row_id
      AND rs.shared_with_user_id = p_user_id AND rs.permission = 'edit'
    );
$$;

-- 5. FIX RLS INSERT policy
DROP POLICY IF EXISTS "insert_prompt_versions" ON public.q_prompt_versions;
CREATE POLICY "insert_prompt_versions" ON public.q_prompt_versions FOR INSERT
WITH CHECK (
  public.current_user_has_allowed_domain()
  AND created_by = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.q_prompts WHERE row_id = prompt_row_id AND owner_id = auth.uid() AND is_deleted = false)
    OR EXISTS (
      SELECT 1 FROM public.resource_shares rs
      WHERE rs.resource_type = 'prompt' AND rs.resource_id = prompt_row_id
      AND rs.shared_with_user_id = auth.uid() AND rs.permission = 'edit'
    )
  )
);

-- 6. FIX RLS UPDATE policy
DROP POLICY IF EXISTS "update_prompt_versions" ON public.q_prompt_versions;
CREATE POLICY "update_prompt_versions" ON public.q_prompt_versions FOR UPDATE
USING (
  public.current_user_has_allowed_domain()
  AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.q_prompts WHERE row_id = prompt_row_id AND owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.resource_shares rs
      WHERE rs.resource_type = 'prompt' AND rs.resource_id = prompt_row_id
      AND rs.shared_with_user_id = auth.uid() AND rs.permission = 'edit'
    )
  )
);

-- 7. Initialize v1 for existing prompts (batched)
DO $$
DECLARE
  v_processed INTEGER := 0;
  v_prompt_row_id UUID;
  v_owner_id UUID;
  v_prompt_record q_prompts;
BEGIN
  FOR v_prompt_row_id, v_owner_id IN 
    SELECT row_id, owner_id FROM q_prompts 
    WHERE is_deleted = false 
    AND (current_version IS NULL OR current_version = 0)
    AND NOT EXISTS (SELECT 1 FROM q_prompt_versions WHERE prompt_row_id = q_prompts.row_id)
    ORDER BY created_at
  LOOP
    SELECT * INTO v_prompt_record FROM q_prompts WHERE row_id = v_prompt_row_id;
    
    INSERT INTO q_prompt_versions (
      prompt_row_id, version_number, commit_message, commit_type,
      snapshot, snapshot_schema_version, fields_changed, created_by
    ) VALUES (
      v_prompt_row_id, 1, 'Initial version (migration)', 'import',
      public.build_prompt_snapshot(v_prompt_record), 1, '{}', v_owner_id
    );
    
    UPDATE q_prompts SET 
      current_version = 1,
      has_uncommitted_changes = false,
      last_committed_at = now()
    WHERE row_id = v_prompt_row_id;
    
    v_processed := v_processed + 1;
  END LOOP;
  
  RAISE NOTICE 'Migration complete. Initialized % prompts.', v_processed;
END $$;