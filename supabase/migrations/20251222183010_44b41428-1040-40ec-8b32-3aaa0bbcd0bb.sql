-- Drop the existing SECURITY DEFINER view
DROP VIEW IF EXISTS public.prompt_owner_emails;

-- Recreate as SECURITY INVOKER (default) - this means RLS on q_prompts will apply
-- The view will only show emails for prompts the user can already access
CREATE VIEW public.prompt_owner_emails 
WITH (security_invoker = true)
AS
SELECT 
    p.row_id AS prompt_row_id,
    p.owner_id,
    pr.email AS owner_email
FROM q_prompts p
LEFT JOIN profiles pr ON pr.id = p.owner_id
WHERE p.owner_id IS NOT NULL;