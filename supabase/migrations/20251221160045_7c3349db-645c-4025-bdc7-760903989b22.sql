-- Create q_thread_messages table for storing conversation history
CREATE TABLE public.q_thread_messages (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_row_id UUID NOT NULL REFERENCES public.q_threads(row_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  response_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  owner_id UUID
);

-- Create index for efficient thread message queries
CREATE INDEX idx_q_thread_messages_thread_row_id ON public.q_thread_messages(thread_row_id);
CREATE INDEX idx_q_thread_messages_created_at ON public.q_thread_messages(created_at);

-- Enable RLS
ALTER TABLE public.q_thread_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for domain users (aligned with existing q_threads policies)
CREATE POLICY "Thread messages viewable by allowed domain users"
  ON public.q_thread_messages
  FOR SELECT
  USING (public.current_user_has_allowed_domain());

CREATE POLICY "Thread messages insertable by allowed domain users"
  ON public.q_thread_messages
  FOR INSERT
  WITH CHECK (public.current_user_has_allowed_domain());

CREATE POLICY "Thread messages updatable by allowed domain users"
  ON public.q_thread_messages
  FOR UPDATE
  USING (public.current_user_has_allowed_domain());

CREATE POLICY "Thread messages deletable by allowed domain users"
  ON public.q_thread_messages
  FOR DELETE
  USING (public.current_user_has_allowed_domain());