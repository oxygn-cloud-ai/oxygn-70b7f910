-- Insert Claude/Anthropic models into q_models table
INSERT INTO q_models (
  model_id, model_name, provider, is_active,
  api_base_url, auth_header_name, auth_header_format,
  context_window, max_output_tokens, token_param,
  supports_temperature, supports_reasoning_effort,
  reasoning_effort_levels,
  input_cost_per_million, output_cost_per_million,
  supported_settings, supported_tools, api_model_id
) VALUES
  -- Claude 4.5 Sonnet (latest flagship)
  ('claude-sonnet-4-5', 'Claude 4.5 Sonnet', 'anthropic', true,
   'https://api.anthropic.com/v1', 'x-api-key', '{key}',
   200000, 8192, 'max_tokens',
   true, false, NULL,
   3.00, 15.00,
   ARRAY['temperature', 'max_tokens', 'top_p', 'stop']::text[],
   ARRAY['file_search']::text[],
   'claude-sonnet-4-5-20250514'),
   
  -- Claude 3.7 Sonnet (extended thinking)
  ('claude-3-7-sonnet', 'Claude 3.7 Sonnet', 'anthropic', true,
   'https://api.anthropic.com/v1', 'x-api-key', '{key}',
   200000, 8192, 'max_tokens',
   true, true, ARRAY['low', 'medium', 'high']::text[],
   3.00, 15.00,
   ARRAY['temperature', 'max_tokens', 'top_p', 'stop']::text[],
   ARRAY['file_search']::text[],
   'claude-3-7-sonnet-20250219'),
   
  -- Claude 3.5 Haiku (fast/cheap)
  ('claude-3-5-haiku', 'Claude 3.5 Haiku', 'anthropic', true,
   'https://api.anthropic.com/v1', 'x-api-key', '{key}',
   200000, 8192, 'max_tokens',
   true, false, NULL,
   0.80, 4.00,
   ARRAY['temperature', 'max_tokens', 'top_p', 'stop']::text[],
   ARRAY[]::text[],
   'claude-3-5-haiku-20241022')
ON CONFLICT (model_id) DO NOTHING;