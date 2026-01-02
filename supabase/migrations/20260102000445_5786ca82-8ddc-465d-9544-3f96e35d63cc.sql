-- Drop unused view that exposes user emails to all authenticated users
DROP VIEW IF EXISTS public.prompt_owner_emails CASCADE;