-- Create table for model-specific default settings
CREATE TABLE public.cyg_model_defaults (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id TEXT NOT NULL,
  temperature TEXT,
  temperature_on BOOLEAN DEFAULT false,
  max_tokens TEXT,
  max_tokens_on BOOLEAN DEFAULT false,
  top_p TEXT,
  top_p_on BOOLEAN DEFAULT false,
  frequency_penalty TEXT,
  frequency_penalty_on BOOLEAN DEFAULT false,
  presence_penalty TEXT,
  presence_penalty_on BOOLEAN DEFAULT false,
  stop TEXT,
  stop_on BOOLEAN DEFAULT false,
  n TEXT,
  n_on BOOLEAN DEFAULT false,
  stream BOOLEAN DEFAULT false,
  stream_on BOOLEAN DEFAULT false,
  response_format TEXT,
  response_format_on BOOLEAN DEFAULT false,
  logit_bias TEXT,
  logit_bias_on BOOLEAN DEFAULT false,
  o_user TEXT,
  o_user_on BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(model_id)
);

-- Enable RLS
ALTER TABLE public.cyg_model_defaults ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Public read access for model defaults"
ON public.cyg_model_defaults FOR SELECT USING (true);

CREATE POLICY "Public insert access for model defaults"
ON public.cyg_model_defaults FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for model defaults"
ON public.cyg_model_defaults FOR UPDATE USING (true);

CREATE POLICY "Public delete access for model defaults"
ON public.cyg_model_defaults FOR DELETE USING (true);