-- Drop existing permissive policies for assistant-files bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to assistant-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from assistant-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to assistant-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from assistant-files" ON storage.objects;

-- Recreate policies with domain validation
CREATE POLICY "Domain users can upload to assistant-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assistant-files' AND current_user_has_allowed_domain());

CREATE POLICY "Domain users can read from assistant-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'assistant-files' AND current_user_has_allowed_domain());

CREATE POLICY "Domain users can update assistant-files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'assistant-files' AND current_user_has_allowed_domain());

CREATE POLICY "Domain users can delete assistant-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'assistant-files' AND current_user_has_allowed_domain());