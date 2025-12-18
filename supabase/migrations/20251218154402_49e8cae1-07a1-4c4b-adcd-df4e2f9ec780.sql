-- Create cyg_confluence_pages table for storing attached Confluence pages
CREATE TABLE public.cyg_confluence_pages (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Attachment target (either assistant or child prompt, or both)
  assistant_row_id UUID REFERENCES public.cyg_assistants(row_id) ON DELETE CASCADE,
  prompt_row_id UUID REFERENCES public.cyg_prompts(row_id) ON DELETE CASCADE,
  -- Confluence page info
  page_id TEXT NOT NULL,
  page_title TEXT NOT NULL,
  space_key TEXT,
  space_name TEXT,
  page_url TEXT,
  -- Cached content
  content_html TEXT,
  content_text TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',
  -- OpenAI integration
  openai_file_id TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cyg_confluence_pages ENABLE ROW LEVEL SECURITY;

-- Create domain-restricted RLS policies
CREATE POLICY "Allowed domain users can read confluence pages"
  ON public.cyg_confluence_pages FOR SELECT
  USING (current_user_has_allowed_domain());

CREATE POLICY "Allowed domain users can insert confluence pages"
  ON public.cyg_confluence_pages FOR INSERT
  WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Allowed domain users can update confluence pages"
  ON public.cyg_confluence_pages FOR UPDATE
  USING (current_user_has_allowed_domain());

CREATE POLICY "Allowed domain users can delete confluence pages"
  ON public.cyg_confluence_pages FOR DELETE
  USING (current_user_has_allowed_domain());

-- Create trigger for updated_at
CREATE TRIGGER update_cyg_confluence_pages_updated_at
  BEFORE UPDATE ON public.cyg_confluence_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();