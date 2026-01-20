-- STEP 1: Drop constraint FIRST (must happen before column renames)
ALTER TABLE q_prompts DROP CONSTRAINT IF EXISTS check_node_type_exclusivity;

-- STEP 2: Drop indexes that reference old column names
DROP INDEX IF EXISTS idx_prompt_variables_session_id;
DROP INDEX IF EXISTS idx_threads_communication_state;

-- STEP 3: Rename columns
ALTER TABLE public.q_prompts 
RENAME COLUMN communication_config TO question_config;

ALTER TABLE public.q_prompt_variables 
RENAME COLUMN communication_session_id TO question_session_id;

ALTER TABLE public.q_threads 
RENAME COLUMN communication_state TO question_state;

-- STEP 4: Update values
UPDATE public.q_prompt_variables 
SET source_type = 'question' 
WHERE source_type = 'communication';

UPDATE public.q_prompts 
SET node_type = 'question' 
WHERE node_type = 'communication';

-- STEP 5: Recreate constraint with new names
ALTER TABLE q_prompts ADD CONSTRAINT check_node_type_exclusivity 
CHECK (
  NOT (node_type = 'action' AND question_config IS NOT NULL)
  AND 
  NOT (node_type = 'question' AND post_action IS NOT NULL)
);

-- STEP 6: Recreate indexes with new column names
CREATE INDEX IF NOT EXISTS idx_prompt_variables_question_session_id 
ON public.q_prompt_variables(question_session_id) 
WHERE question_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_threads_question_state 
ON public.q_threads((question_state IS NOT NULL)) 
WHERE question_state IS NOT NULL;

-- STEP 7: Update column comments
COMMENT ON COLUMN public.q_prompts.question_config IS 'Configuration for question prompt type: max_questions, completion_mode, show_progress';
COMMENT ON COLUMN public.q_prompt_variables.question_session_id IS 'Session ID for grouping variables from a single question session';
COMMENT ON COLUMN public.q_threads.question_state IS 'Current question session state: is_active, current_question, questions_asked, collected_variables';