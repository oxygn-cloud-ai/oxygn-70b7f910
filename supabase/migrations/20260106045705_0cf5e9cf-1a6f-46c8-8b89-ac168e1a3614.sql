-- Phase 0: Fix GPT-5 model api_model_id (they were incorrectly pointing to gpt-4o-mini)
UPDATE public.q_models SET 
  api_model_id = 'gpt-5-mini-2025-08-07'
WHERE model_id = 'gpt-5-mini';

UPDATE public.q_models SET 
  api_model_id = 'gpt-5-nano-2025-08-07'
WHERE model_id = 'gpt-5-nano';

-- Phase 1: Add max_completion_tokens columns to q_prompts
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS max_completion_tokens text NULL,
ADD COLUMN IF NOT EXISTS max_completion_tokens_on boolean DEFAULT false;

-- Add max_completion_tokens columns to q_model_defaults
ALTER TABLE public.q_model_defaults 
ADD COLUMN IF NOT EXISTS max_completion_tokens text NULL,
ADD COLUMN IF NOT EXISTS max_completion_tokens_on boolean DEFAULT false;

-- Add max_completion_tokens_override to q_assistants
ALTER TABLE public.q_assistants 
ADD COLUMN IF NOT EXISTS max_completion_tokens_override text NULL;

-- Ensure GPT-5 models have correct supported_settings (max_completion_tokens, NOT max_tokens)
UPDATE public.q_models SET 
  supported_settings = ARRAY['max_completion_tokens', 'seed', 'tool_choice', 'reasoning_effort', 'response_format']
WHERE model_id IN ('gpt-5', 'gpt-5-mini', 'gpt-5-nano');

-- Ensure GPT-4 models have max_tokens in supported_settings (NOT max_completion_tokens)
UPDATE public.q_models SET 
  supported_settings = ARRAY['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'seed', 'response_format']
WHERE model_id IN ('gpt-4o', 'gpt-4o-mini');