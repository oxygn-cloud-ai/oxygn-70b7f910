-- Update q_templates SELECT policy to allow all users to view all templates
DROP POLICY IF EXISTS "Users can read own templates" ON public.q_templates;

CREATE POLICY "Users can view all templates"
ON public.q_templates
FOR SELECT
TO public
USING (current_user_has_allowed_domain() AND (is_deleted IS NOT TRUE));

-- Update q_json_schema_templates SELECT policy to allow all users to view all schema templates
DROP POLICY IF EXISTS "Users can view own or system schema templates" ON public.q_json_schema_templates;

CREATE POLICY "Users can view all schema templates"
ON public.q_json_schema_templates
FOR SELECT
TO public
USING (current_user_has_allowed_domain() AND (is_deleted IS NOT TRUE));

-- Update q_export_templates SELECT policy to allow all users to view all export templates
DROP POLICY IF EXISTS "Users can view their own export templates or public ones" ON public.q_export_templates;

CREATE POLICY "Users can view all export templates"
ON public.q_export_templates
FOR SELECT
TO authenticated
USING (is_deleted IS NOT TRUE);