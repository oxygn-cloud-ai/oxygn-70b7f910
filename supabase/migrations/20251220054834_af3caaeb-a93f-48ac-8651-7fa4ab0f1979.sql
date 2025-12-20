-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Domain users can read cost records" ON public.cyg_ai_costs;

-- Create a new policy that restricts users to their own records, while admins can see all
CREATE POLICY "Users can read own cost records, admins all"
ON public.cyg_ai_costs
FOR SELECT
USING (
  current_user_has_allowed_domain() 
  AND (
    is_admin(auth.uid()) 
    OR user_id = auth.uid()
  )
);