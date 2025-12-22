-- Create storage bucket for workbench files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workbench-files',
  'workbench-files',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for workbench-files storage
CREATE POLICY "Users can upload their own workbench files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'workbench-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own workbench files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'workbench-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own workbench files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'workbench-files' AND auth.uid()::text = (storage.foldername(name))[1]);