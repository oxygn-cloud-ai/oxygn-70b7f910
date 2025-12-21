-- Migration: Full OpenAI Conversations API Integration
-- This removes local message storage and uses OpenAI Conversations API for all state

-- Step 1: Drop the q_thread_messages table (all messages will be fetched from OpenAI)
DROP TABLE IF EXISTS public.q_thread_messages;

-- Step 2: Modify q_threads table
-- First, update any existing null openai_conversation_id values with a placeholder
-- (existing threads will need new conversations created on first use)
UPDATE public.q_threads 
SET openai_conversation_id = 'pending_' || row_id::text 
WHERE openai_conversation_id IS NULL OR openai_conversation_id LIKE 'local_%';

-- Step 3: Drop the legacy columns that are no longer needed
ALTER TABLE public.q_threads DROP COLUMN IF EXISTS openai_thread_id;
ALTER TABLE public.q_threads DROP COLUMN IF EXISTS last_response_id;

-- Step 4: Make openai_conversation_id NOT NULL (it's the primary OpenAI reference now)
ALTER TABLE public.q_threads ALTER COLUMN openai_conversation_id SET NOT NULL;

-- Step 5: Add an index on openai_conversation_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_q_threads_openai_conversation_id ON public.q_threads(openai_conversation_id);