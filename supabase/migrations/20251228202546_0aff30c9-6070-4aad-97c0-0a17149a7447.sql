-- Update RLS policy to explicitly handle built-in templates (owner_id IS NULL)
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own schema templates" ON public.q_json_schema_templates;

-- Create more explicit SELECT policy that handles NULL owner_id
CREATE POLICY "Users can view accessible schema templates" 
ON public.q_json_schema_templates FOR SELECT 
USING (
  owner_id IS NULL  -- Built-in templates (visible to everyone)
  OR owner_id = auth.uid()  -- User's own templates
  OR is_private = false  -- Explicitly public templates
);