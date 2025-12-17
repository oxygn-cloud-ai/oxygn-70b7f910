-- Create a function to check if an email domain is allowed
-- This will be used in RLS policies to enforce domain restrictions server-side

CREATE OR REPLACE FUNCTION public.is_allowed_domain(email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN email IS NULL THEN false
    ELSE (
      split_part(lower(email), '@', 2) IN ('chocfin.com', 'oxygn.cloud')
    )
  END;
$$;

-- Create a function to check if the current user has an allowed domain
CREATE OR REPLACE FUNCTION public.current_user_has_allowed_domain()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_allowed_domain(auth.email());
$$;