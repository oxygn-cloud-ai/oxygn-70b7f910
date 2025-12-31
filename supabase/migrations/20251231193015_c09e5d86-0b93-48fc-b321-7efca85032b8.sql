-- Add last_action_result column to store action execution history
ALTER TABLE q_prompts ADD COLUMN IF NOT EXISTS last_action_result JSONB;

-- Add comment for documentation
COMMENT ON COLUMN q_prompts.last_action_result IS 'Stores the result of the last action execution: {status, created_count, error, executed_at}';