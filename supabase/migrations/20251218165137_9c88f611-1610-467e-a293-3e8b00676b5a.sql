-- Add confluence_enabled columns for live browsing capability
ALTER TABLE public.cyg_assistants 
ADD COLUMN IF NOT EXISTS confluence_enabled boolean DEFAULT false;

ALTER TABLE public.cyg_prompts 
ADD COLUMN IF NOT EXISTS confluence_enabled boolean DEFAULT false;