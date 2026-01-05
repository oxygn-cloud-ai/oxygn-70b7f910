-- Fix GPT-5 model: Remove frequency_penalty and presence_penalty from supported_settings
-- The OpenAI Responses API does NOT support these parameters for o-series models

UPDATE q_models 
SET supported_settings = ARRAY['max_completion_tokens', 'seed', 'tool_choice', 'reasoning_effort', 'response_format']
WHERE model_id = 'gpt-5';

-- Also update gpt-5-mini and gpt-5-nano if they exist with same issue
UPDATE q_models 
SET supported_settings = ARRAY['max_completion_tokens', 'seed', 'tool_choice', 'reasoning_effort', 'response_format']
WHERE model_id IN ('gpt-5-mini', 'gpt-5-nano')
  AND supported_settings @> ARRAY['frequency_penalty'];