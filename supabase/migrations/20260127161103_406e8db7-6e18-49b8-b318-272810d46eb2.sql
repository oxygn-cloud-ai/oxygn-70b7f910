-- Add purpose column to q_threads for track isolation
ALTER TABLE q_threads 
ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'run';

-- Create composite index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_threads_family_purpose 
ON q_threads(root_prompt_row_id, owner_id, provider, purpose, is_active)
WHERE is_active = true;

-- Update existing threads: assume all existing are 'run' (execution)
-- Chat threads will be created fresh on first use
COMMENT ON COLUMN q_threads.purpose IS 'Thread track: chat for interactive chat, run for prompt execution';