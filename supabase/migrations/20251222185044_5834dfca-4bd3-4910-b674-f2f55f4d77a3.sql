-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create a policy that allows domain users to view basic profile info of other domain users
-- This is needed so users can see owner names on shared prompts
CREATE POLICY "Domain users can view profiles"
ON public.profiles
FOR SELECT
USING (current_user_has_allowed_domain());

-- Users can only update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);