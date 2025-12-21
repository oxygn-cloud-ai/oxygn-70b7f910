-- Add exclude_from_cascade field to both prompts tables
ALTER TABLE public.cyg_prompts 
ADD COLUMN IF NOT EXISTS exclude_from_cascade boolean DEFAULT false;

ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS exclude_from_cascade boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.cyg_prompts.exclude_from_cascade IS 'When true, this prompt will be skipped during cascade runs';
COMMENT ON COLUMN public.q_prompts.exclude_from_cascade IS 'When true, this prompt will be skipped during cascade runs';