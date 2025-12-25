-- Create table for export templates
CREATE TABLE public.q_export_templates (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  export_type TEXT NOT NULL DEFAULT 'confluence',
  selected_fields TEXT[] DEFAULT ARRAY['output_response', 'prompt_name'],
  selected_variables JSONB DEFAULT '{}',
  confluence_config JSONB DEFAULT '{}',
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.q_export_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own templates and public templates
CREATE POLICY "Users can view own or public export templates"
ON public.q_export_templates
FOR SELECT
USING (
  owner_id = auth.uid() OR is_private = false
);

-- Policy: Users can create their own templates
CREATE POLICY "Users can create own export templates"
ON public.q_export_templates
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can update their own templates
CREATE POLICY "Users can update own export templates"
ON public.q_export_templates
FOR UPDATE
USING (auth.uid() = owner_id);

-- Policy: Users can delete their own templates
CREATE POLICY "Users can delete own export templates"
ON public.q_export_templates
FOR DELETE
USING (auth.uid() = owner_id);

-- Create updated_at trigger
CREATE TRIGGER update_q_export_templates_updated_at
BEFORE UPDATE ON public.q_export_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_export_templates_owner ON public.q_export_templates(owner_id);
CREATE INDEX idx_export_templates_type ON public.q_export_templates(export_type);