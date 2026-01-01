-- Add admin bypass to q_export_templates RLS policies

-- Drop and recreate SELECT policy with admin bypass
DROP POLICY IF EXISTS "Users can view their own export templates or public ones" ON public.q_export_templates;
CREATE POLICY "Users can view their own export templates or public ones"
ON public.q_export_templates
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()) OR owner_id = auth.uid() OR is_private = false);

-- Drop and recreate UPDATE policy with admin bypass
DROP POLICY IF EXISTS "Users can update their own export templates" ON public.q_export_templates;
CREATE POLICY "Users can update their own export templates"
ON public.q_export_templates
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()) OR auth.uid() = owner_id);

-- Drop and recreate DELETE policy with admin bypass
DROP POLICY IF EXISTS "Users can delete their own export templates" ON public.q_export_templates;
CREATE POLICY "Users can delete their own export templates"
ON public.q_export_templates
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()) OR auth.uid() = owner_id);

-- Add admin bypass to q_json_schema_templates RLS policies

-- Drop and recreate UPDATE policy with admin bypass
DROP POLICY IF EXISTS "Users can update their own schema templates" ON public.q_json_schema_templates;
CREATE POLICY "Users can update their own schema templates"
ON public.q_json_schema_templates
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()) OR auth.uid() = owner_id);

-- Drop and recreate DELETE policy with admin bypass
DROP POLICY IF EXISTS "Users can delete their own schema templates" ON public.q_json_schema_templates;
CREATE POLICY "Users can delete their own schema templates"
ON public.q_json_schema_templates
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()) OR auth.uid() = owner_id);