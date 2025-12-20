-- =====================================================
-- PHASE 1: Foundation - Template System & Variable Engine
-- =====================================================

-- 1. Create cyg_templates table for storing template definitions
CREATE TABLE public.cyg_templates (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL DEFAULT 'New Template',
  template_description TEXT,
  category TEXT DEFAULT 'general',
  structure JSONB NOT NULL DEFAULT '{}',
  owner_id UUID,
  is_private BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on cyg_templates
ALTER TABLE public.cyg_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for cyg_templates (same pattern as cyg_prompts)
CREATE POLICY "Domain users can insert templates"
ON public.cyg_templates
FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Users can read accessible templates"
ON public.cyg_templates
FOR SELECT
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    owner_id = auth.uid() OR
    (is_private = false OR is_private IS NULL)
  )
);

CREATE POLICY "Owners and admins can update templates"
ON public.cyg_templates
FOR UPDATE
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    owner_id = auth.uid()
  )
);

CREATE POLICY "Owners and admins can delete templates"
ON public.cyg_templates
FOR DELETE
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    owner_id = auth.uid()
  )
);

-- 2. Create cyg_prompt_variables table for user-defined variables per prompt
CREATE TABLE public.cyg_prompt_variables (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_row_id UUID NOT NULL,
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_description TEXT,
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(prompt_row_id, variable_name)
);

-- Enable RLS on cyg_prompt_variables
ALTER TABLE public.cyg_prompt_variables ENABLE ROW LEVEL SECURITY;

-- RLS policies for cyg_prompt_variables (follows prompt ownership)
CREATE POLICY "Domain users can insert prompt variables"
ON public.cyg_prompt_variables
FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Users can read accessible prompt variables"
ON public.cyg_prompt_variables
FOR SELECT
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    can_read_resource('prompt', prompt_row_id)
  )
);

CREATE POLICY "Owners and admins can update prompt variables"
ON public.cyg_prompt_variables
FOR UPDATE
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    can_edit_resource('prompt', prompt_row_id)
  )
);

CREATE POLICY "Owners and admins can delete prompt variables"
ON public.cyg_prompt_variables
FOR DELETE
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    can_edit_resource('prompt', prompt_row_id)
  )
);

-- 3. Create cyg_ai_costs table for immutable cost tracking
CREATE TABLE public.cyg_ai_costs (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_row_id UUID NOT NULL,
  top_level_prompt_row_id UUID NOT NULL,
  user_id UUID,
  model TEXT NOT NULL,
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  tokens_total INTEGER NOT NULL DEFAULT 0,
  cost_input_usd NUMERIC(12, 8) DEFAULT 0,
  cost_output_usd NUMERIC(12, 8) DEFAULT 0,
  cost_total_usd NUMERIC(12, 8) DEFAULT 0,
  response_id TEXT,
  finish_reason TEXT,
  latency_ms INTEGER,
  prompt_name_snapshot TEXT,
  top_level_prompt_name_snapshot TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on cyg_ai_costs
ALTER TABLE public.cyg_ai_costs ENABLE ROW LEVEL SECURITY;

-- RLS policies for cyg_ai_costs (read-only for users, insert allowed)
CREATE POLICY "Domain users can insert cost records"
ON public.cyg_ai_costs
FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Domain users can read cost records"
ON public.cyg_ai_costs
FOR SELECT
USING (current_user_has_allowed_domain());

-- No update or delete policies - costs are immutable

-- 4. Add system_variables JSONB column to cyg_prompts for storing resolved system variables
ALTER TABLE public.cyg_prompts 
ADD COLUMN IF NOT EXISTS system_variables JSONB DEFAULT '{}';

-- 5. Add template_row_id to track which template was used to create a prompt
ALTER TABLE public.cyg_prompts 
ADD COLUMN IF NOT EXISTS template_row_id UUID;

-- 6. Add last_ai_call_metadata to store the most recent AI call details
ALTER TABLE public.cyg_prompts 
ADD COLUMN IF NOT EXISTS last_ai_call_metadata JSONB DEFAULT '{}';

-- 7. Create index for faster cost aggregations
CREATE INDEX idx_cyg_ai_costs_top_level_prompt ON public.cyg_ai_costs(top_level_prompt_row_id);
CREATE INDEX idx_cyg_ai_costs_prompt ON public.cyg_ai_costs(prompt_row_id);
CREATE INDEX idx_cyg_ai_costs_user ON public.cyg_ai_costs(user_id);
CREATE INDEX idx_cyg_ai_costs_created ON public.cyg_ai_costs(created_at);

-- 8. Create index for template lookups
CREATE INDEX idx_cyg_templates_owner ON public.cyg_templates(owner_id);
CREATE INDEX idx_cyg_templates_category ON public.cyg_templates(category);

-- 9. Create index for prompt variables
CREATE INDEX idx_cyg_prompt_variables_prompt ON public.cyg_prompt_variables(prompt_row_id);

-- 10. Create triggers for updated_at
CREATE TRIGGER update_cyg_templates_updated_at
BEFORE UPDATE ON public.cyg_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cyg_prompt_variables_updated_at
BEFORE UPDATE ON public.cyg_prompt_variables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Create model pricing table for cost calculations
CREATE TABLE public.cyg_model_pricing (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id TEXT NOT NULL UNIQUE,
  cost_per_1k_input_tokens NUMERIC(12, 8) NOT NULL DEFAULT 0,
  cost_per_1k_output_tokens NUMERIC(12, 8) NOT NULL DEFAULT 0,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on cyg_model_pricing
ALTER TABLE public.cyg_model_pricing ENABLE ROW LEVEL SECURITY;

-- RLS policies for cyg_model_pricing (read for all, admin for write)
CREATE POLICY "Domain users can read model pricing"
ON public.cyg_model_pricing
FOR SELECT
USING (current_user_has_allowed_domain());

CREATE POLICY "Admins can insert model pricing"
ON public.cyg_model_pricing
FOR INSERT
WITH CHECK (current_user_has_allowed_domain() AND is_admin(auth.uid()));

CREATE POLICY "Admins can update model pricing"
ON public.cyg_model_pricing
FOR UPDATE
USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete model pricing"
ON public.cyg_model_pricing
FOR DELETE
USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_cyg_model_pricing_updated_at
BEFORE UPDATE ON public.cyg_model_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Insert default OpenAI pricing (as of late 2024)
INSERT INTO public.cyg_model_pricing (model_id, cost_per_1k_input_tokens, cost_per_1k_output_tokens) VALUES
('gpt-4o', 0.0025, 0.01),
('gpt-4o-mini', 0.00015, 0.0006),
('gpt-4-turbo', 0.01, 0.03),
('gpt-4', 0.03, 0.06),
('gpt-3.5-turbo', 0.0005, 0.0015),
('o1', 0.015, 0.06),
('o1-mini', 0.003, 0.012),
('o1-preview', 0.015, 0.06),
('o3-mini', 0.0011, 0.0044)
ON CONFLICT (model_id) DO NOTHING;