-- ============================================================================
-- Phase 1: AI Model Settings & Multi-Type Template Management
-- ============================================================================

-- 1. Create q_json_schema_templates table for reusable JSON schemas
CREATE TABLE IF NOT EXISTS public.q_json_schema_templates (
  row_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_name text NOT NULL,
  schema_description text,
  category text DEFAULT 'general',
  json_schema jsonb NOT NULL,
  is_private boolean DEFAULT true,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on q_json_schema_templates
ALTER TABLE public.q_json_schema_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for q_json_schema_templates
CREATE POLICY "Users can view their own schema templates" 
ON public.q_json_schema_templates FOR SELECT 
USING (owner_id = auth.uid() OR is_private = false);

CREATE POLICY "Users can create their own schema templates" 
ON public.q_json_schema_templates FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own schema templates" 
ON public.q_json_schema_templates FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own schema templates" 
ON public.q_json_schema_templates FOR DELETE 
USING (auth.uid() = owner_id);

-- 2. Add new AI settings columns to q_prompts
ALTER TABLE public.q_prompts ADD COLUMN IF NOT EXISTS seed text;
ALTER TABLE public.q_prompts ADD COLUMN IF NOT EXISTS seed_on boolean DEFAULT false;
ALTER TABLE public.q_prompts ADD COLUMN IF NOT EXISTS tool_choice text DEFAULT 'auto';
ALTER TABLE public.q_prompts ADD COLUMN IF NOT EXISTS tool_choice_on boolean DEFAULT false;
ALTER TABLE public.q_prompts ADD COLUMN IF NOT EXISTS reasoning_effort text DEFAULT 'medium';
ALTER TABLE public.q_prompts ADD COLUMN IF NOT EXISTS reasoning_effort_on boolean DEFAULT false;
ALTER TABLE public.q_prompts ADD COLUMN IF NOT EXISTS code_interpreter_on boolean DEFAULT false;
ALTER TABLE public.q_prompts ADD COLUMN IF NOT EXISTS file_search_on boolean DEFAULT false;
ALTER TABLE public.q_prompts ADD COLUMN IF NOT EXISTS json_schema_template_id uuid REFERENCES public.q_json_schema_templates(row_id) ON DELETE SET NULL;

-- 3. Add default_action_system_prompt to settings (no ON CONFLICT, just insert if not exists)
INSERT INTO public.q_settings (setting_key, setting_value, setting_description)
SELECT 
  'default_action_system_prompt',
  'You are an AI assistant that MUST respond with valid JSON matching the required schema exactly.

IMPORTANT INSTRUCTIONS:
1. Your response MUST be a valid JSON object - no markdown, no explanations, no additional text
2. Include ALL required fields specified in the schema
3. Use the exact field names and types defined in the schema
4. Do not include any fields not defined in the schema
5. Ensure arrays contain items of the correct type
6. All string values should be meaningful and relevant to the user''s request

{{schema_description}}

Respond ONLY with the JSON object. No other text before or after.',
  'Default system prompt used for action nodes to ensure structured JSON output. Use {{schema_description}} as a placeholder for the schema details.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.q_settings WHERE setting_key = 'default_action_system_prompt'
);

-- 4. Create trigger for updated_at on json_schema_templates
CREATE TRIGGER update_json_schema_templates_updated_at
  BEFORE UPDATE ON public.q_json_schema_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();