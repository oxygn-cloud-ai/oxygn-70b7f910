-- Create backups table for storing backup metadata
CREATE TABLE public.q_backups (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  backup_type TEXT DEFAULT 'full',
  tables_included TEXT[],
  include_storage BOOLEAN DEFAULT true,
  file_size_bytes BIGINT,
  table_counts JSONB,
  status TEXT DEFAULT 'completed',
  storage_path TEXT,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.q_backups ENABLE ROW LEVEL SECURITY;

-- Only admins can access backups
CREATE POLICY "Admins can view all backups"
ON public.q_backups
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can create backups"
ON public.q_backups
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update backups"
ON public.q_backups
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete backups"
ON public.q_backups
FOR DELETE
USING (public.is_admin(auth.uid()));