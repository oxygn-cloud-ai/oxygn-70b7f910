-- ============================================================================
-- BACKFILL root_prompt_row_id for q_prompts (fixes family isolation)
-- ============================================================================

-- Step 1: Set root_prompt_row_id = row_id for all top-level prompts (no parent)
UPDATE public.q_prompts
SET root_prompt_row_id = row_id
WHERE parent_row_id IS NULL 
  AND (root_prompt_row_id IS NULL OR root_prompt_row_id != row_id);

-- Step 2: Recursive CTE to propagate root_prompt_row_id to all descendants
WITH RECURSIVE prompt_tree AS (
  -- Base case: top-level prompts (root_prompt_row_id = row_id)
  SELECT row_id, row_id AS computed_root
  FROM public.q_prompts
  WHERE parent_row_id IS NULL

  UNION ALL

  -- Recursive case: children inherit root from parent
  SELECT p.row_id, pt.computed_root
  FROM public.q_prompts p
  INNER JOIN prompt_tree pt ON p.parent_row_id = pt.row_id
)
UPDATE public.q_prompts p
SET root_prompt_row_id = pt.computed_root
FROM prompt_tree pt
WHERE p.row_id = pt.row_id
  AND (p.root_prompt_row_id IS NULL OR p.root_prompt_row_id != pt.computed_root);

-- ============================================================================
-- BACKFILL root_prompt_row_id for q_threads
-- ============================================================================

-- Set root_prompt_row_id from child_prompt's family
UPDATE public.q_threads t
SET root_prompt_row_id = p.root_prompt_row_id
FROM public.q_prompts p
WHERE t.child_prompt_row_id = p.row_id
  AND t.root_prompt_row_id IS NULL
  AND p.root_prompt_row_id IS NOT NULL;

-- For threads with only root_prompt_row_id references (no child), verify they match
UPDATE public.q_threads t
SET root_prompt_row_id = t.root_prompt_row_id
WHERE t.root_prompt_row_id IS NOT NULL
  AND t.child_prompt_row_id IS NULL;

-- ============================================================================
-- ENHANCE compute_root_prompt_row_id trigger to handle edge cases
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_root_prompt_row_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  current_id UUID;
  visited_ids UUID[] := ARRAY[]::UUID[];
  max_depth INTEGER := 20;
  depth INTEGER := 0;
  parent_root UUID;
BEGIN
  -- If no parent, this is the root
  IF NEW.parent_row_id IS NULL THEN
    NEW.root_prompt_row_id := NEW.row_id;
    RETURN NEW;
  END IF;

  -- Try to get root from parent first (fast path)
  SELECT root_prompt_row_id INTO parent_root
  FROM q_prompts
  WHERE row_id = NEW.parent_row_id;
  
  -- If parent has root already, use it
  IF parent_root IS NOT NULL THEN
    NEW.root_prompt_row_id := parent_root;
    RETURN NEW;
  END IF;

  -- Fallback: Walk up parent chain with cycle detection
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
$function$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS trg_compute_root_prompt ON public.q_prompts;
CREATE TRIGGER trg_compute_root_prompt
  BEFORE INSERT OR UPDATE OF parent_row_id ON public.q_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_root_prompt_row_id();