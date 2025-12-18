-- Add parent_page_id column to track hierarchy
ALTER TABLE public.cyg_confluence_pages 
ADD COLUMN parent_page_id TEXT;