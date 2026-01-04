-- Fix function search_path security warnings
-- Set explicit search_path for all newly created functions

CREATE OR REPLACE FUNCTION compute_root_prompt_row_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION increment_family_version()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM q_rate_limits WHERE window_start < now() - interval '5 minutes';
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_orphaned_traces()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE q_execution_traces
  SET status = 'failed',
      error_summary = 'Execution timed out after 30 minutes',
      completed_at = now()
  WHERE status = 'running'
    AND started_at < now() - interval '30 minutes';
END;
$$;