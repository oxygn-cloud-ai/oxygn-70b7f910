-- Create a function to get user email by ID (for display purposes)
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = _user_id
$$;

-- Create a view for prompt owners that includes email
CREATE OR REPLACE VIEW public.prompt_owner_emails AS
SELECT 
  p.row_id as prompt_row_id,
  p.owner_id,
  public.get_user_email(p.owner_id) as owner_email
FROM public.cyg_prompts p
WHERE p.owner_id IS NOT NULL;