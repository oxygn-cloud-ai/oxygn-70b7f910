-- Update reasoning effort levels to the correct OpenAI API values
UPDATE q_models 
SET reasoning_effort_levels = ARRAY['low', 'medium', 'high']
WHERE supports_reasoning_effort = true;