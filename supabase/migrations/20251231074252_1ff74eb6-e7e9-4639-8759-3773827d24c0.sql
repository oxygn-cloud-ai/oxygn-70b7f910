-- Add root_prompt_row_id for unified family thread lookup
ALTER TABLE q_threads ADD COLUMN IF NOT EXISTS root_prompt_row_id UUID REFERENCES q_prompts(row_id);

-- Unique constraint: one active thread per family per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_q_threads_family_unique 
  ON q_threads(root_prompt_row_id, owner_id) 
  WHERE is_active = true AND root_prompt_row_id IS NOT NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_q_threads_root_prompt 
  ON q_threads(root_prompt_row_id) 
  WHERE root_prompt_row_id IS NOT NULL;

COMMENT ON COLUMN q_threads.root_prompt_row_id IS 
  'Root prompt ID for unified family thread. All prompts in a family share the same thread via this column.';