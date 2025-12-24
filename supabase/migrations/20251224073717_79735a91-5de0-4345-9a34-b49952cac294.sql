-- Add position column to store Confluence UI ordering
ALTER TABLE public.q_confluence_pages ADD COLUMN IF NOT EXISTS position INTEGER;

-- Add index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_confluence_pages_position ON q_confluence_pages(parent_page_id, position);