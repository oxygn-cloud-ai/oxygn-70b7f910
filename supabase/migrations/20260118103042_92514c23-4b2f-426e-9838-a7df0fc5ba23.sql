-- Step 1: Delete incompatible OpenAI models (don't work with Responses API)
DELETE FROM q_models 
WHERE provider = 'openai' 
AND model_id IN ('gpt-4', 'gpt-4-turbo');

-- Step 2: Activate existing compatible models
UPDATE q_models 
SET is_active = true 
WHERE model_id IN ('gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano');

-- Step 3: Add missing reasoning models (o1, o1-mini, o3, o4-mini)
INSERT INTO q_models (
  model_id, model_name, provider, is_active, 
  api_model_id, context_window, max_output_tokens,
  token_param, supports_temperature, supports_reasoning_effort,
  reasoning_effort_levels, supported_settings, supported_tools,
  input_cost_per_million, output_cost_per_million,
  api_base_url, auth_header_name, auth_header_format
) VALUES 
-- o1
(
  'o1', 'o1', 'openai', true,
  'o1', 200000, 100000,
  'max_completion_tokens', false, true,
  ARRAY['low', 'medium', 'high'], 
  ARRAY['seed', 'tool_choice', 'reasoning_effort', 'response_format', 'max_output_tokens'],
  ARRAY['web_search', 'code_interpreter', 'file_search'],
  15.00, 60.00,
  'https://api.openai.com/v1', 'Authorization', 'Bearer {key}'
),
-- o1-mini
(
  'o1-mini', 'o1 Mini', 'openai', true,
  'o1-mini', 128000, 65536,
  'max_completion_tokens', false, true,
  ARRAY['low', 'medium', 'high'],
  ARRAY['seed', 'tool_choice', 'reasoning_effort', 'response_format', 'max_output_tokens'],
  ARRAY['web_search', 'code_interpreter', 'file_search'],
  1.10, 4.40,
  'https://api.openai.com/v1', 'Authorization', 'Bearer {key}'
),
-- o3
(
  'o3', 'o3', 'openai', true,
  'o3', 200000, 100000,
  'max_completion_tokens', false, true,
  ARRAY['low', 'medium', 'high'],
  ARRAY['seed', 'tool_choice', 'reasoning_effort', 'response_format', 'max_output_tokens'],
  ARRAY['web_search', 'code_interpreter', 'file_search'],
  10.00, 40.00,
  'https://api.openai.com/v1', 'Authorization', 'Bearer {key}'
),
-- o4-mini
(
  'o4-mini', 'o4 Mini', 'openai', true,
  'o4-mini', 200000, 100000,
  'max_completion_tokens', false, true,
  ARRAY['low', 'medium', 'high'],
  ARRAY['seed', 'tool_choice', 'reasoning_effort', 'response_format', 'max_output_tokens'],
  ARRAY['web_search', 'code_interpreter', 'file_search'],
  1.10, 4.40,
  'https://api.openai.com/v1', 'Authorization', 'Bearer {key}'
);