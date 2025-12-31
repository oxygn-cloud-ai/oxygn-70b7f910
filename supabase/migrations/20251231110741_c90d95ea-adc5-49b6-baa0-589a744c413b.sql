-- Add sample_output column to q_json_schema_templates for admin-defined sample outputs
ALTER TABLE public.q_json_schema_templates 
ADD COLUMN IF NOT EXISTS sample_output JSONB DEFAULT NULL;

COMMENT ON COLUMN public.q_json_schema_templates.sample_output IS 
'Admin-defined sample output JSON. When NULL, auto-generated preview is used.';