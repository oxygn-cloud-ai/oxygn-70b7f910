-- prompt_owner_emails is a VIEW, so we need to recreate it with security invoker
-- First, let's drop and recreate the view with proper security
DROP VIEW IF EXISTS public.prompt_owner_emails;

-- Recreate the view with SECURITY INVOKER (respects underlying table RLS)
CREATE OR REPLACE VIEW public.prompt_owner_emails 
WITH (security_invoker = true)
AS
SELECT 
  p.owner_id,
  (SELECT email FROM auth.users WHERE id = p.owner_id) as owner_email,
  p.row_id as prompt_row_id
FROM public.q_prompts p
WHERE p.owner_id IS NOT NULL;