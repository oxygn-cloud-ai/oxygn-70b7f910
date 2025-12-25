-- Add Action Node columns to q_prompts table

-- Node type: 'standard' (default) or 'action'
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS node_type text DEFAULT 'standard';

-- Post-action to execute after AI response (stores action type id)
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS post_action text DEFAULT null;

-- Post-action configuration (JSON) - flexible schema per action type
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS post_action_config jsonb DEFAULT null;

-- Extracted JSON variables from last AI response (stored as key-value pairs)
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS extracted_variables jsonb DEFAULT null;

-- Library prompt reference (at design time, copies content from library)
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS library_prompt_id uuid DEFAULT null;

-- Index for efficient lookup of action nodes
CREATE INDEX IF NOT EXISTS idx_prompts_node_type ON public.q_prompts(node_type);

-- Comment for documentation
COMMENT ON COLUMN public.q_prompts.node_type IS 'Node behavior type: standard (normal prompt) or action (JSON response with post-actions)';
COMMENT ON COLUMN public.q_prompts.post_action IS 'Action type ID to execute after AI response (e.g., create_children_json)';
COMMENT ON COLUMN public.q_prompts.post_action_config IS 'Configuration object for the selected post-action';
COMMENT ON COLUMN public.q_prompts.extracted_variables IS 'Parsed JSON response stored as accessible variables';