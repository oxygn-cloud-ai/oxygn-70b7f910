-- Add content_type column to q_confluence_pages to store the Confluence content type (page, blogpost, folder, whiteboard, database)
ALTER TABLE public.q_confluence_pages 
ADD COLUMN content_type TEXT DEFAULT 'page';