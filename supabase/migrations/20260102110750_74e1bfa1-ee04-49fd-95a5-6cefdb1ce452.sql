-- Layer A: Backend invariant enforcement

-- A1) Create trigger function to enforce action node invariants
CREATE OR REPLACE FUNCTION public.enforce_prompt_action_invariants()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: If post_action is set, force node_type to 'action'
  IF NEW.post_action IS NOT NULL THEN
    NEW.node_type := 'action';
  END IF;
  
  -- Rule 2: If node_type is NOT 'action', clear all action-related fields
  IF NEW.node_type IS DISTINCT FROM 'action' THEN
    NEW.post_action := NULL;
    NEW.post_action_config := NULL;
    NEW.json_schema_template_id := NULL;
    NEW.extracted_variables := NULL;
    NEW.last_action_result := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS enforce_prompt_action_invariants_trigger ON public.q_prompts;
CREATE TRIGGER enforce_prompt_action_invariants_trigger
  BEFORE INSERT OR UPDATE ON public.q_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_prompt_action_invariants();

-- A2) One-time cleanup: fix existing inconsistent rows
UPDATE public.q_prompts
SET node_type = 'action'
WHERE post_action IS NOT NULL
  AND (node_type IS NULL OR node_type != 'action');