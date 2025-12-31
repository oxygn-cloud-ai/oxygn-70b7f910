-- Re-add last_response_id column for Responses API context chaining
ALTER TABLE q_threads ADD COLUMN IF NOT EXISTS last_response_id TEXT;

COMMENT ON COLUMN q_threads.last_response_id IS 
  'Last OpenAI Responses API response ID (resp_...) for previous_response_id chaining';

CREATE INDEX IF NOT EXISTS idx_q_threads_last_response_id 
  ON q_threads(last_response_id) WHERE last_response_id IS NOT NULL;