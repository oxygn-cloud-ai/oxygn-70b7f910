-- Phase 1: Database Schema Updates for OpenAI Responses API Migration
-- These columns support both APIs during the transition period

-- Add conversation support columns to cyg_threads
ALTER TABLE cyg_threads ADD COLUMN IF NOT EXISTS openai_conversation_id TEXT;
ALTER TABLE cyg_threads ADD COLUMN IF NOT EXISTS last_response_id TEXT;

-- Add API version tracking to cyg_assistants
-- Values: 'assistants' (legacy) | 'responses' (new)
ALTER TABLE cyg_assistants ADD COLUMN IF NOT EXISTS api_version TEXT DEFAULT 'assistants';

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_cyg_threads_conversation_id ON cyg_threads(openai_conversation_id) WHERE openai_conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cyg_assistants_api_version ON cyg_assistants(api_version);

-- Add comment for documentation
COMMENT ON COLUMN cyg_threads.openai_conversation_id IS 'OpenAI Conversations API conversation ID (conv_...)';
COMMENT ON COLUMN cyg_threads.last_response_id IS 'Last OpenAI Responses API response ID (resp_...) for continuation';
COMMENT ON COLUMN cyg_assistants.api_version IS 'API version: assistants (legacy) or responses (new)';