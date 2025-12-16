-- Create cyg_prompts table (tree structure for prompts)
CREATE TABLE public.cyg_prompts (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_row_id UUID REFERENCES public.cyg_prompts(row_id) ON DELETE SET NULL,
  prompt_name TEXT NOT NULL DEFAULT 'New Prompt',
  input_admin_prompt TEXT,
  input_user_prompt TEXT,
  output_response TEXT,
  position INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cyg_settings table (key-value settings)
CREATE TABLE public.cyg_settings (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  setting_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cyg_models table (AI models configuration)
CREATE TABLE public.cyg_models (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL,
  model_id TEXT NOT NULL UNIQUE,
  provider TEXT DEFAULT 'openai',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  project_row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT UNIQUE,
  project_name TEXT NOT NULL DEFAULT 'New Project',
  project_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cyg_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cyg_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cyg_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create public access policies for cyg_prompts
CREATE POLICY "Public read access for prompts" ON public.cyg_prompts FOR SELECT USING (true);
CREATE POLICY "Public insert access for prompts" ON public.cyg_prompts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for prompts" ON public.cyg_prompts FOR UPDATE USING (true);
CREATE POLICY "Public delete access for prompts" ON public.cyg_prompts FOR DELETE USING (true);

-- Create public access policies for cyg_settings
CREATE POLICY "Public read access for settings" ON public.cyg_settings FOR SELECT USING (true);
CREATE POLICY "Public insert access for settings" ON public.cyg_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for settings" ON public.cyg_settings FOR UPDATE USING (true);
CREATE POLICY "Public delete access for settings" ON public.cyg_settings FOR DELETE USING (true);

-- Create public access policies for cyg_models
CREATE POLICY "Public read access for models" ON public.cyg_models FOR SELECT USING (true);
CREATE POLICY "Public insert access for models" ON public.cyg_models FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for models" ON public.cyg_models FOR UPDATE USING (true);
CREATE POLICY "Public delete access for models" ON public.cyg_models FOR DELETE USING (true);

-- Create public access policies for projects
CREATE POLICY "Public read access for projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Public insert access for projects" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for projects" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Public delete access for projects" ON public.projects FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_cyg_prompts_updated_at BEFORE UPDATE ON public.cyg_prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cyg_settings_updated_at BEFORE UPDATE ON public.cyg_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cyg_models_updated_at BEFORE UPDATE ON public.cyg_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for tree structure
CREATE INDEX idx_cyg_prompts_parent ON public.cyg_prompts(parent_row_id);
CREATE INDEX idx_cyg_prompts_position ON public.cyg_prompts(position);
CREATE INDEX idx_cyg_prompts_is_deleted ON public.cyg_prompts(is_deleted);

-- Insert some default models
INSERT INTO public.cyg_models (model_name, model_id, provider) VALUES
  ('GPT-4o', 'gpt-4o', 'openai'),
  ('GPT-4o Mini', 'gpt-4o-mini', 'openai'),
  ('GPT-4 Turbo', 'gpt-4-turbo', 'openai'),
  ('GPT-3.5 Turbo', 'gpt-3.5-turbo', 'openai');