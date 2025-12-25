-- Add exclude_from_export column to q_prompts table
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS exclude_from_export boolean DEFAULT false;

COMMENT ON COLUMN public.q_prompts.exclude_from_export IS 'When true, this prompt will be skipped during exports';