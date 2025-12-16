-- Add web search toggle to prompts table
ALTER TABLE public.cyg_prompts 
ADD COLUMN IF NOT EXISTS web_search_on boolean DEFAULT false;