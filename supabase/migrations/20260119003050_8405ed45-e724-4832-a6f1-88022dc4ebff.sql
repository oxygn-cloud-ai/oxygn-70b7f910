-- Phase 1: Database Migration for Communication Prompt Feature

-- 1. Add source tracking columns to q_prompt_variables
ALTER TABLE public.q_prompt_variables 
ADD COLUMN IF NOT EXISTS source_question TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS communication_session_id UUID DEFAULT NULL;

COMMENT ON COLUMN public.q_prompt_variables.source_question IS 'AI question that prompted this value (for communication prompts)';
COMMENT ON COLUMN public.q_prompt_variables.source_type IS 'Origin of the variable: manual, ai_action, or communication';
COMMENT ON COLUMN public.q_prompt_variables.communication_session_id IS 'Session ID for grouping variables from a single communication session';

-- 2. Add communication config to q_prompts
ALTER TABLE public.q_prompts 
ADD COLUMN IF NOT EXISTS communication_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.q_prompts.communication_config IS 'Configuration for communication node type: max_questions, completion_mode, show_progress';

-- 3. Add communication state to q_threads
ALTER TABLE public.q_threads 
ADD COLUMN IF NOT EXISTS communication_state JSONB DEFAULT NULL;

COMMENT ON COLUMN public.q_threads.communication_state IS 'Current communication session state: is_active, current_question, questions_asked, collected_variables';

-- 4. Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_prompt_variables_source_type ON public.q_prompt_variables(source_type);
CREATE INDEX IF NOT EXISTS idx_prompt_variables_session_id ON public.q_prompt_variables(communication_session_id) WHERE communication_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threads_communication_state ON public.q_threads((communication_state IS NOT NULL)) WHERE communication_state IS NOT NULL;