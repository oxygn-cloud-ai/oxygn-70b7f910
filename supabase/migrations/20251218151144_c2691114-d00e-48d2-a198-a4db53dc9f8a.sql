-- Strengthen the domain check function to explicitly verify user authentication
-- This adds defense-in-depth by checking auth.uid() is not null alongside domain validation

CREATE OR REPLACE FUNCTION public.current_user_has_allowed_domain()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    -- First verify user is authenticated (auth.uid() is not null)
    WHEN auth.uid() IS NULL THEN false
    -- Then verify email exists
    WHEN auth.email() IS NULL THEN false
    -- Finally verify domain is allowed
    ELSE (
      split_part(lower(auth.email()), '@', 2) IN ('chocfin.com', 'oxygn.cloud')
    )
  END;
$$;

-- Also strengthen the is_allowed_domain function for consistency
CREATE OR REPLACE FUNCTION public.is_allowed_domain(email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN email IS NULL THEN false
    WHEN email = '' THEN false
    WHEN position('@' IN email) = 0 THEN false
    ELSE (
      split_part(lower(email), '@', 2) IN ('chocfin.com', 'oxygn.cloud')
    )
  END;
$$;