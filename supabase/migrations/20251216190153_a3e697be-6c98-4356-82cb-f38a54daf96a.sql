-- Add missing result columns to cyg_prompts
ALTER TABLE public.cyg_prompts 
ADD COLUMN IF NOT EXISTS user_prompt_result text,
ADD COLUMN IF NOT EXISTS admin_prompt_result text,
ADD COLUMN IF NOT EXISTS note text;