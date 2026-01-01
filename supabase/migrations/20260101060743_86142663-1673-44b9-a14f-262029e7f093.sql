-- Drop old duplicate policies that don't have admin bypass
DROP POLICY IF EXISTS "Users can delete own export templates" ON public.q_export_templates;
DROP POLICY IF EXISTS "Users can view own or public export templates" ON public.q_export_templates;
DROP POLICY IF EXISTS "Users can update own export templates" ON public.q_export_templates;