-- Phase 1: Add error_code column to q_manus_tasks table
ALTER TABLE q_manus_tasks 
ADD COLUMN IF NOT EXISTS error_code TEXT;

COMMENT ON COLUMN q_manus_tasks.error_code IS 'Structured error code for failed/cancelled tasks (from ERROR_CODES enum)';