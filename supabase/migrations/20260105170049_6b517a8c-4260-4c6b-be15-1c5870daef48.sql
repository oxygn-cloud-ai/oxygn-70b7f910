-- Update GPT-5 models to use correct Responses API parameter name
UPDATE q_models 
SET token_param = 'max_output_tokens'
WHERE model_id IN ('gpt-5', 'gpt-5-mini', 'gpt-5-nano');

-- Update supported_settings to use correct parameter name for all models
UPDATE q_models 
SET supported_settings = array_replace(supported_settings, 'max_completion_tokens', 'max_output_tokens')
WHERE 'max_completion_tokens' = ANY(supported_settings);