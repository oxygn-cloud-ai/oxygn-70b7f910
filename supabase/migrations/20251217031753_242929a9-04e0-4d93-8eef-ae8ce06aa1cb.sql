-- Phase 1: OpenAI Assistants Integration - Database Schema

-- 1. Create cyg_assistant_tool_defaults table (global tool defaults)
CREATE TABLE public.cyg_assistant_tool_defaults (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_interpreter_enabled BOOLEAN DEFAULT true,
  file_search_enabled BOOLEAN DEFAULT true,
  function_calling_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cyg_assistant_tool_defaults ENABLE ROW LEVEL SECURITY;

-- RLS policies for tool defaults
CREATE POLICY "Public read access for assistant tool defaults"
ON public.cyg_assistant_tool_defaults FOR SELECT USING (true);

CREATE POLICY "Public insert access for assistant tool defaults"
ON public.cyg_assistant_tool_defaults FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for assistant tool defaults"
ON public.cyg_assistant_tool_defaults FOR UPDATE USING (true);

CREATE POLICY "Public delete access for assistant tool defaults"
ON public.cyg_assistant_tool_defaults FOR DELETE USING (true);

-- Insert default row
INSERT INTO public.cyg_assistant_tool_defaults (code_interpreter_enabled, file_search_enabled, function_calling_enabled)
VALUES (true, true, false);

-- Trigger for updated_at
CREATE TRIGGER update_cyg_assistant_tool_defaults_updated_at
BEFORE UPDATE ON public.cyg_assistant_tool_defaults
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create cyg_vector_stores table (shared vector stores)
CREATE TABLE public.cyg_vector_stores (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  openai_vector_store_id TEXT,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cyg_vector_stores ENABLE ROW LEVEL SECURITY;

-- RLS policies for vector stores
CREATE POLICY "Public read access for vector stores"
ON public.cyg_vector_stores FOR SELECT USING (true);

CREATE POLICY "Public insert access for vector stores"
ON public.cyg_vector_stores FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for vector stores"
ON public.cyg_vector_stores FOR UPDATE USING (true);

CREATE POLICY "Public delete access for vector stores"
ON public.cyg_vector_stores FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_cyg_vector_stores_updated_at
BEFORE UPDATE ON public.cyg_vector_stores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add columns to cyg_prompts
ALTER TABLE public.cyg_prompts ADD COLUMN is_assistant BOOLEAN DEFAULT false;
ALTER TABLE public.cyg_prompts ADD COLUMN thread_mode TEXT DEFAULT 'new';

-- 4. Create cyg_assistants table
CREATE TABLE public.cyg_assistants (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_row_id UUID REFERENCES public.cyg_prompts(row_id) ON DELETE CASCADE,
  openai_assistant_id TEXT,
  name TEXT NOT NULL DEFAULT 'New Assistant',
  instructions TEXT,
  
  -- Model configuration (NULL = inherit from prompt)
  model_override TEXT,
  temperature_override TEXT,
  max_tokens_override TEXT,
  top_p_override TEXT,
  
  -- Tools configuration (NULL = use global defaults)
  code_interpreter_enabled BOOLEAN,
  file_search_enabled BOOLEAN,
  function_calling_enabled BOOLEAN,
  use_global_tool_defaults BOOLEAN DEFAULT true,
  
  -- Vector Store
  vector_store_id TEXT,
  shared_vector_store_row_id UUID REFERENCES public.cyg_vector_stores(row_id) ON DELETE SET NULL,
  use_shared_vector_store BOOLEAN DEFAULT false,
  
  -- State
  status TEXT DEFAULT 'not_instantiated',
  last_instantiated_at TIMESTAMPTZ,
  last_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(prompt_row_id)
);

-- Enable RLS
ALTER TABLE public.cyg_assistants ENABLE ROW LEVEL SECURITY;

-- RLS policies for assistants
CREATE POLICY "Public read access for assistants"
ON public.cyg_assistants FOR SELECT USING (true);

CREATE POLICY "Public insert access for assistants"
ON public.cyg_assistants FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for assistants"
ON public.cyg_assistants FOR UPDATE USING (true);

CREATE POLICY "Public delete access for assistants"
ON public.cyg_assistants FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_cyg_assistants_updated_at
BEFORE UPDATE ON public.cyg_assistants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Create cyg_assistant_files table
CREATE TABLE public.cyg_assistant_files (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_row_id UUID REFERENCES public.cyg_assistants(row_id) ON DELETE CASCADE,
  
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  
  openai_file_id TEXT,
  upload_status TEXT DEFAULT 'pending',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cyg_assistant_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for assistant files
CREATE POLICY "Public read access for assistant files"
ON public.cyg_assistant_files FOR SELECT USING (true);

CREATE POLICY "Public insert access for assistant files"
ON public.cyg_assistant_files FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for assistant files"
ON public.cyg_assistant_files FOR UPDATE USING (true);

CREATE POLICY "Public delete access for assistant files"
ON public.cyg_assistant_files FOR DELETE USING (true);

-- 6. Create cyg_threads table
CREATE TABLE public.cyg_threads (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_row_id UUID REFERENCES public.cyg_assistants(row_id) ON DELETE CASCADE,
  child_prompt_row_id UUID REFERENCES public.cyg_prompts(row_id) ON DELETE SET NULL,
  openai_thread_id TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  message_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.cyg_threads ENABLE ROW LEVEL SECURITY;

-- RLS policies for threads
CREATE POLICY "Public read access for threads"
ON public.cyg_threads FOR SELECT USING (true);

CREATE POLICY "Public insert access for threads"
ON public.cyg_threads FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for threads"
ON public.cyg_threads FOR UPDATE USING (true);

CREATE POLICY "Public delete access for threads"
ON public.cyg_threads FOR DELETE USING (true);

-- 7. Create storage bucket for assistant files
INSERT INTO storage.buckets (id, name, public)
VALUES ('assistant-files', 'assistant-files', false);

-- Storage RLS policies
CREATE POLICY "Allow authenticated uploads to assistant-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assistant-files');

CREATE POLICY "Allow authenticated reads from assistant-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'assistant-files');

CREATE POLICY "Allow authenticated updates to assistant-files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'assistant-files');

CREATE POLICY "Allow authenticated deletes from assistant-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'assistant-files');