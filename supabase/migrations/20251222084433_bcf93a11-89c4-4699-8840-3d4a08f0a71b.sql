-- =============================================
-- WORKBENCH TABLES - Phase 1
-- =============================================

-- q_workbench_threads: Workbench conversation threads
CREATE TABLE q_workbench_threads (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID,
  title TEXT DEFAULT 'New Workbench Thread',
  openai_conversation_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- q_workbench_messages: Messages within workbench threads
CREATE TABLE q_workbench_messages (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_row_id UUID REFERENCES q_workbench_threads(row_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- q_workbench_files: Files attached to workbench threads
CREATE TABLE q_workbench_files (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_row_id UUID REFERENCES q_workbench_threads(row_id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  openai_file_id TEXT,
  upload_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- q_workbench_confluence_links: Confluence pages linked to workbench threads
CREATE TABLE q_workbench_confluence_links (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_row_id UUID REFERENCES q_workbench_threads(row_id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  page_title TEXT,
  page_url TEXT,
  space_key TEXT,
  content_text TEXT,
  sync_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- q_prompt_library: User's personal prompt snippets (default shared)
CREATE TABLE q_prompt_library (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID,
  name TEXT NOT NULL,
  content TEXT,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE q_workbench_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE q_workbench_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE q_workbench_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE q_workbench_confluence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE q_prompt_library ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES FOR q_workbench_threads
-- =============================================

CREATE POLICY "Domain users can insert workbench threads"
ON q_workbench_threads FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Users can read own workbench threads"
ON q_workbench_threads FOR SELECT
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid() OR user_id = auth.uid()));

CREATE POLICY "Users can update own workbench threads"
ON q_workbench_threads FOR UPDATE
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid() OR user_id = auth.uid()));

CREATE POLICY "Users can delete own workbench threads"
ON q_workbench_threads FOR DELETE
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid() OR user_id = auth.uid()));

-- =============================================
-- RLS POLICIES FOR q_workbench_messages
-- =============================================

CREATE POLICY "Domain users can insert workbench messages"
ON q_workbench_messages FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Users can read messages in own threads"
ON q_workbench_messages FOR SELECT
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM q_workbench_threads t 
    WHERE t.row_id = q_workbench_messages.thread_row_id 
    AND (t.owner_id = auth.uid() OR t.user_id = auth.uid())
  )
));

CREATE POLICY "Users can update messages in own threads"
ON q_workbench_messages FOR UPDATE
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM q_workbench_threads t 
    WHERE t.row_id = q_workbench_messages.thread_row_id 
    AND (t.owner_id = auth.uid() OR t.user_id = auth.uid())
  )
));

CREATE POLICY "Users can delete messages in own threads"
ON q_workbench_messages FOR DELETE
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM q_workbench_threads t 
    WHERE t.row_id = q_workbench_messages.thread_row_id 
    AND (t.owner_id = auth.uid() OR t.user_id = auth.uid())
  )
));

-- =============================================
-- RLS POLICIES FOR q_workbench_files
-- =============================================

CREATE POLICY "Domain users can insert workbench files"
ON q_workbench_files FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Users can read files in own threads"
ON q_workbench_files FOR SELECT
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM q_workbench_threads t 
    WHERE t.row_id = q_workbench_files.thread_row_id 
    AND (t.owner_id = auth.uid() OR t.user_id = auth.uid())
  )
));

CREATE POLICY "Users can update files in own threads"
ON q_workbench_files FOR UPDATE
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM q_workbench_threads t 
    WHERE t.row_id = q_workbench_files.thread_row_id 
    AND (t.owner_id = auth.uid() OR t.user_id = auth.uid())
  )
));

CREATE POLICY "Users can delete files in own threads"
ON q_workbench_files FOR DELETE
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM q_workbench_threads t 
    WHERE t.row_id = q_workbench_files.thread_row_id 
    AND (t.owner_id = auth.uid() OR t.user_id = auth.uid())
  )
));

-- =============================================
-- RLS POLICIES FOR q_workbench_confluence_links
-- =============================================

CREATE POLICY "Domain users can insert workbench confluence links"
ON q_workbench_confluence_links FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Users can read confluence links in own threads"
ON q_workbench_confluence_links FOR SELECT
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM q_workbench_threads t 
    WHERE t.row_id = q_workbench_confluence_links.thread_row_id 
    AND (t.owner_id = auth.uid() OR t.user_id = auth.uid())
  )
));

CREATE POLICY "Users can update confluence links in own threads"
ON q_workbench_confluence_links FOR UPDATE
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM q_workbench_threads t 
    WHERE t.row_id = q_workbench_confluence_links.thread_row_id 
    AND (t.owner_id = auth.uid() OR t.user_id = auth.uid())
  )
));

CREATE POLICY "Users can delete confluence links in own threads"
ON q_workbench_confluence_links FOR DELETE
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM q_workbench_threads t 
    WHERE t.row_id = q_workbench_confluence_links.thread_row_id 
    AND (t.owner_id = auth.uid() OR t.user_id = auth.uid())
  )
));

-- =============================================
-- RLS POLICIES FOR q_prompt_library
-- =============================================

CREATE POLICY "Domain users can insert prompt library items"
ON q_prompt_library FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Users can read shared or own library items"
ON q_prompt_library FOR SELECT
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  owner_id = auth.uid() OR 
  user_id = auth.uid() OR 
  is_private = false
));

CREATE POLICY "Users can update own library items"
ON q_prompt_library FOR UPDATE
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  owner_id = auth.uid() OR 
  user_id = auth.uid()
));

CREATE POLICY "Users can delete own library items"
ON q_prompt_library FOR DELETE
USING (current_user_has_allowed_domain() AND (
  is_admin(auth.uid()) OR 
  owner_id = auth.uid() OR 
  user_id = auth.uid()
));

-- =============================================
-- UPDATE TRIGGERS FOR updated_at
-- =============================================

CREATE TRIGGER update_workbench_threads_updated_at
BEFORE UPDATE ON q_workbench_threads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prompt_library_updated_at
BEFORE UPDATE ON q_prompt_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STORAGE BUCKET FOR WORKBENCH FILES
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('workbench-files', 'workbench-files', false, 52428800);

-- Storage policies for workbench-files bucket
CREATE POLICY "Users can upload workbench files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'workbench-files' AND 
  current_user_has_allowed_domain()
);

CREATE POLICY "Users can read own workbench files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'workbench-files' AND 
  current_user_has_allowed_domain() AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own workbench files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'workbench-files' AND 
  current_user_has_allowed_domain() AND
  auth.uid()::text = (storage.foldername(name))[1]
);