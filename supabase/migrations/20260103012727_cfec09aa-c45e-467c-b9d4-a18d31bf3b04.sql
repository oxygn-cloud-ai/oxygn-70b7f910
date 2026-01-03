-- Drop and recreate the UPDATE policy with proper WITH CHECK clause
DROP POLICY IF EXISTS "q Owners and admins can update templates" ON public.q_templates;

CREATE POLICY "q Owners and admins can update templates"
ON public.q_templates
FOR UPDATE
USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid())))
WITH CHECK (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid())));