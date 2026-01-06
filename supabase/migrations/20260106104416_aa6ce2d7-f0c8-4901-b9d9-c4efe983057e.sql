-- Phase 1: Add max_output_tokens columns to relevant tables

-- Add max_output_tokens to q_prompts
ALTER TABLE q_prompts 
  ADD COLUMN IF NOT EXISTS max_output_tokens text,
  ADD COLUMN IF NOT EXISTS max_output_tokens_on boolean DEFAULT false;

-- Add max_output_tokens to q_model_defaults
ALTER TABLE q_model_defaults 
  ADD COLUMN IF NOT EXISTS max_output_tokens text,
  ADD COLUMN IF NOT EXISTS max_output_tokens_on boolean DEFAULT false;

-- Add max_output_tokens_override to q_assistants
ALTER TABLE q_assistants 
  ADD COLUMN IF NOT EXISTS max_output_tokens_override text;

-- Migrate existing data from q_prompts (prefer max_completion_tokens over max_tokens)
UPDATE q_prompts 
SET max_output_tokens = COALESCE(max_completion_tokens, max_tokens),
    max_output_tokens_on = COALESCE(max_completion_tokens_on, max_tokens_on, false)
WHERE max_output_tokens IS NULL 
  AND (max_completion_tokens IS NOT NULL OR max_tokens IS NOT NULL);

-- Migrate existing data from q_model_defaults
UPDATE q_model_defaults 
SET max_output_tokens = COALESCE(max_completion_tokens, max_tokens),
    max_output_tokens_on = COALESCE(max_completion_tokens_on, max_tokens_on, false)
WHERE max_output_tokens IS NULL 
  AND (max_completion_tokens IS NOT NULL OR max_tokens IS NOT NULL);

-- Migrate existing data from q_assistants
UPDATE q_assistants 
SET max_output_tokens_override = COALESCE(max_completion_tokens_override, max_tokens_override)
WHERE max_output_tokens_override IS NULL 
  AND (max_completion_tokens_override IS NOT NULL OR max_tokens_override IS NOT NULL);

-- Update OpenAI model capabilities to use max_output_tokens instead of old token params
UPDATE q_models 
SET supported_settings = array_remove(array_remove(supported_settings, 'max_tokens'), 'max_completion_tokens') || ARRAY['max_output_tokens']
WHERE provider = 'openai' 
  AND supported_settings IS NOT NULL
  AND NOT ('max_output_tokens' = ANY(supported_settings));