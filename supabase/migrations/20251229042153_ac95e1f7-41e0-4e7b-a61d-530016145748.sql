-- Phase 1: Extend q_models table with model capability columns
-- First add unique constraint on model_id, then add columns and seed data

-- Add unique constraint on model_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'q_models_model_id_key') THEN
    ALTER TABLE q_models ADD CONSTRAINT q_models_model_id_key UNIQUE (model_id);
  END IF;
END $$;

-- Add capability columns to q_models
ALTER TABLE q_models 
ADD COLUMN IF NOT EXISTS context_window INTEGER DEFAULT 128000,
ADD COLUMN IF NOT EXISTS max_output_tokens INTEGER DEFAULT 16384,
ADD COLUMN IF NOT EXISTS token_param TEXT DEFAULT 'max_tokens',
ADD COLUMN IF NOT EXISTS supports_temperature BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS supports_reasoning_effort BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reasoning_effort_levels TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supported_settings TEXT[] DEFAULT ARRAY['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
ADD COLUMN IF NOT EXISTS supported_tools TEXT[] DEFAULT ARRAY['web_search', 'code_interpreter', 'file_search'],
ADD COLUMN IF NOT EXISTS api_model_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_snapshot BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS snapshot_of TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deprecation_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS input_cost_per_million DECIMAL(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_cost_per_million DECIMAL(10,4) DEFAULT 0;

-- Update existing models with correct configurations

-- GPT-4o family
UPDATE q_models SET 
  context_window = 128000, max_output_tokens = 16384, token_param = 'max_tokens',
  supports_temperature = true, supports_reasoning_effort = false,
  supported_settings = ARRAY['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
  supported_tools = ARRAY['web_search', 'code_interpreter', 'file_search'],
  api_model_id = 'gpt-4o', input_cost_per_million = 2.50, output_cost_per_million = 10.00
WHERE model_id = 'gpt-4o';

UPDATE q_models SET 
  context_window = 128000, max_output_tokens = 16384, token_param = 'max_tokens',
  supports_temperature = true, supports_reasoning_effort = false,
  supported_settings = ARRAY['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
  supported_tools = ARRAY['web_search', 'code_interpreter', 'file_search'],
  api_model_id = 'gpt-4o-mini', input_cost_per_million = 0.15, output_cost_per_million = 0.60
WHERE model_id = 'gpt-4o-mini';

-- GPT-5 family
UPDATE q_models SET 
  context_window = 128000, max_output_tokens = 32768, token_param = 'max_completion_tokens',
  supports_temperature = false, supports_reasoning_effort = true,
  reasoning_effort_levels = ARRAY['low', 'medium', 'high'],
  supported_settings = ARRAY['max_completion_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'reasoning_effort', 'response_format'],
  supported_tools = ARRAY['web_search', 'code_interpreter', 'file_search'],
  api_model_id = 'gpt-4o', input_cost_per_million = 5.00, output_cost_per_million = 15.00
WHERE model_id = 'gpt-5';

UPDATE q_models SET 
  context_window = 128000, max_output_tokens = 32768, token_param = 'max_completion_tokens',
  supports_temperature = false, supports_reasoning_effort = true,
  reasoning_effort_levels = ARRAY['low', 'medium', 'high'],
  supported_settings = ARRAY['max_completion_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'reasoning_effort', 'response_format'],
  supported_tools = ARRAY['web_search', 'code_interpreter', 'file_search'],
  api_model_id = 'gpt-4o-mini', input_cost_per_million = 1.25, output_cost_per_million = 5.00
WHERE model_id = 'gpt-5-mini';

UPDATE q_models SET 
  context_window = 128000, max_output_tokens = 16384, token_param = 'max_completion_tokens',
  supports_temperature = false, supports_reasoning_effort = false,
  supported_settings = ARRAY['max_completion_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
  supported_tools = ARRAY['web_search', 'code_interpreter', 'file_search'],
  api_model_id = 'gpt-4o-mini', input_cost_per_million = 0.50, output_cost_per_million = 2.00
WHERE model_id = 'gpt-5-nano';

-- O-series reasoning models
UPDATE q_models SET 
  context_window = 200000, max_output_tokens = 100000, token_param = 'max_completion_tokens',
  supports_temperature = false, supports_reasoning_effort = true,
  reasoning_effort_levels = ARRAY['low', 'medium', 'high'],
  supported_settings = ARRAY['max_completion_tokens', 'reasoning_effort', 'response_format'],
  supported_tools = ARRAY[]::TEXT[],
  api_model_id = 'o1', input_cost_per_million = 15.00, output_cost_per_million = 60.00
WHERE model_id = 'o1';

UPDATE q_models SET 
  context_window = 128000, max_output_tokens = 32768, token_param = 'max_completion_tokens',
  supports_temperature = false, supports_reasoning_effort = true,
  reasoning_effort_levels = ARRAY['low', 'medium', 'high'],
  supported_settings = ARRAY['max_completion_tokens', 'reasoning_effort', 'response_format'],
  supported_tools = ARRAY[]::TEXT[],
  api_model_id = 'o1-preview', input_cost_per_million = 15.00, output_cost_per_million = 60.00
WHERE model_id = 'o1-preview';

UPDATE q_models SET 
  context_window = 128000, max_output_tokens = 65536, token_param = 'max_completion_tokens',
  supports_temperature = false, supports_reasoning_effort = true,
  reasoning_effort_levels = ARRAY['low', 'medium', 'high'],
  supported_settings = ARRAY['max_completion_tokens', 'reasoning_effort', 'response_format'],
  supported_tools = ARRAY[]::TEXT[],
  api_model_id = 'o1-mini', input_cost_per_million = 3.00, output_cost_per_million = 12.00
WHERE model_id = 'o1-mini';

UPDATE q_models SET 
  context_window = 200000, max_output_tokens = 100000, token_param = 'max_completion_tokens',
  supports_temperature = false, supports_reasoning_effort = true,
  reasoning_effort_levels = ARRAY['low', 'medium', 'high'],
  supported_settings = ARRAY['max_completion_tokens', 'reasoning_effort', 'response_format'],
  supported_tools = ARRAY['web_search', 'code_interpreter', 'file_search'],
  api_model_id = 'o3-mini', input_cost_per_million = 1.10, output_cost_per_million = 4.40
WHERE model_id = 'o3-mini';

-- GPT-3.5 Turbo
UPDATE q_models SET 
  context_window = 16385, max_output_tokens = 4096, token_param = 'max_tokens',
  supports_temperature = true, supports_reasoning_effort = false,
  supported_settings = ARRAY['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
  supported_tools = ARRAY['web_search'],
  api_model_id = 'gpt-3.5-turbo', input_cost_per_million = 0.50, output_cost_per_million = 1.50
WHERE model_id = 'gpt-3.5-turbo';

-- Insert missing models (using ON CONFLICT now that we have unique constraint)
INSERT INTO q_models (model_id, model_name, provider, is_active, context_window, max_output_tokens, token_param, supports_temperature, supports_reasoning_effort, reasoning_effort_levels, supported_settings, supported_tools, api_model_id, input_cost_per_million, output_cost_per_million)
VALUES 
  ('gpt-4.1', 'GPT-4.1', 'openai', false, 1047576, 32768, 'max_tokens', true, false, NULL,
   ARRAY['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
   ARRAY['web_search', 'code_interpreter', 'file_search'], 'gpt-4.1', 2.00, 8.00),
  ('gpt-4.1-mini', 'GPT-4.1 Mini', 'openai', false, 1047576, 32768, 'max_tokens', true, false, NULL,
   ARRAY['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
   ARRAY['web_search', 'code_interpreter', 'file_search'], 'gpt-4.1-mini', 0.40, 1.60),
  ('gpt-4.1-nano', 'GPT-4.1 Nano', 'openai', false, 1047576, 32768, 'max_tokens', true, false, NULL,
   ARRAY['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
   ARRAY['web_search', 'code_interpreter', 'file_search'], 'gpt-4.1-nano', 0.10, 0.40),
  ('o3', 'o3', 'openai', false, 200000, 100000, 'max_completion_tokens', false, true, ARRAY['low', 'medium', 'high'],
   ARRAY['max_completion_tokens', 'reasoning_effort', 'response_format'],
   ARRAY['web_search', 'code_interpreter', 'file_search'], 'o3', 10.00, 40.00),
  ('o4-mini', 'o4 Mini', 'openai', false, 200000, 100000, 'max_completion_tokens', false, true, ARRAY['low', 'medium', 'high'],
   ARRAY['max_completion_tokens', 'reasoning_effort', 'response_format'],
   ARRAY['web_search', 'code_interpreter', 'file_search'], 'o4-mini', 1.10, 4.40)
ON CONFLICT (model_id) DO NOTHING;