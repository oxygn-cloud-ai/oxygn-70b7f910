-- Add child_thread_strategy column to cyg_prompts for child prompts
-- Values: 'parent' (use parent's studio thread) or 'isolated' (child has own threads)
ALTER TABLE public.cyg_prompts 
ADD COLUMN IF NOT EXISTS child_thread_strategy text DEFAULT 'isolated';

-- Add default_child_thread_strategy column to cyg_prompts for parent prompts
-- This sets the default strategy for newly created child prompts
ALTER TABLE public.cyg_prompts 
ADD COLUMN IF NOT EXISTS default_child_thread_strategy text DEFAULT 'isolated';

-- Add comment for documentation
COMMENT ON COLUMN public.cyg_prompts.child_thread_strategy IS 'Thread strategy for child prompts: parent (use parent studio thread) or isolated (child has own threads)';
COMMENT ON COLUMN public.cyg_prompts.default_child_thread_strategy IS 'Default thread strategy applied to new child prompts';