-- Drop existing constraint that doesn't account for purpose
DROP INDEX IF EXISTS idx_q_threads_family_unique;

-- Create new constraint that allows one active thread per purpose
CREATE UNIQUE INDEX idx_q_threads_family_unique 
ON public.q_threads (root_prompt_row_id, owner_id, purpose) 
WHERE is_active = true AND root_prompt_row_id IS NOT NULL;