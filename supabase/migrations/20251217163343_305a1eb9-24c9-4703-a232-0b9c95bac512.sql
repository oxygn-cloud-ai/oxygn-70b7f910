-- Drop existing overly permissive policies on cyg_prompts
DROP POLICY IF EXISTS "Public read access for prompts" ON cyg_prompts;
DROP POLICY IF EXISTS "Public insert access for prompts" ON cyg_prompts;
DROP POLICY IF EXISTS "Public update access for prompts" ON cyg_prompts;
DROP POLICY IF EXISTS "Public delete access for prompts" ON cyg_prompts;

-- Create new domain-restricted policies for cyg_prompts
CREATE POLICY "Allowed domain users can read prompts"
ON cyg_prompts FOR SELECT
TO authenticated
USING (public.current_user_has_allowed_domain());

CREATE POLICY "Allowed domain users can insert prompts"
ON cyg_prompts FOR INSERT
TO authenticated
WITH CHECK (public.current_user_has_allowed_domain());

CREATE POLICY "Allowed domain users can update prompts"
ON cyg_prompts FOR UPDATE
TO authenticated
USING (public.current_user_has_allowed_domain());

CREATE POLICY "Allowed domain users can delete prompts"
ON cyg_prompts FOR DELETE
TO authenticated
USING (public.current_user_has_allowed_domain());