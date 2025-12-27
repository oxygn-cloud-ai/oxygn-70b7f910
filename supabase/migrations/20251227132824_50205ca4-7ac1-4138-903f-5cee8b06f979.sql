-- Add starred column to q_prompts table for Phase 1 functionality
ALTER TABLE public.q_prompts
ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;