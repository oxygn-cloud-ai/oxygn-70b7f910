-- Add variable_assignments_config column for AI-driven variable assignments
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS variable_assignments_config jsonb DEFAULT null;

-- Add auto_run_children column for automatic child cascade execution
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS auto_run_children boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.q_prompts.variable_assignments_config IS 
  'Configuration for AI-driven variable assignments: {enabled: boolean, json_path: string, auto_create_variables: boolean}';

COMMENT ON COLUMN public.q_prompts.auto_run_children IS 
  'When true, newly created child prompts from post-actions are immediately executed as a mini-cascade';