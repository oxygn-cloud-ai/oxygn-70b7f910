-- Add conversation support columns to q_threads (used by edge functions)
ALTER TABLE q_threads ADD COLUMN IF NOT EXISTS openai_conversation_id TEXT;
ALTER TABLE q_threads ADD COLUMN IF NOT EXISTS last_response_id TEXT;

-- Add API version tracking to q_assistants (used by edge functions)
ALTER TABLE q_assistants ADD COLUMN IF NOT EXISTS api_version TEXT DEFAULT 'assistants';

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_q_threads_conversation_id ON q_threads(openai_conversation_id) WHERE openai_conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_q_assistants_api_version ON q_assistants(api_version);

-- Add comments
COMMENT ON COLUMN q_threads.openai_conversation_id IS 'OpenAI Conversations API conversation ID (conv_...)';
COMMENT ON COLUMN q_threads.last_response_id IS 'Last OpenAI Responses API response ID (resp_...) for continuation';
COMMENT ON COLUMN q_assistants.api_version IS 'API version: assistants (legacy) or responses (new)';