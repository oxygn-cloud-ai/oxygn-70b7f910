-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Domain users can view profiles" ON public.profiles;

-- Create a restricted policy - users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (current_user_has_allowed_domain() AND auth.uid() = id);