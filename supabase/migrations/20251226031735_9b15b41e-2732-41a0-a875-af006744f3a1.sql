-- Add icon_name column to q_prompts table for custom Lucide icon selection
ALTER TABLE public.q_prompts ADD COLUMN IF NOT EXISTS icon_name text;