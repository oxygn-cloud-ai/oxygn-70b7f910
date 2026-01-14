-- Phase 1: Data Cleanup Migration
-- Fix NULL positions using created_at timestamp
UPDATE q_prompts 
SET position = EXTRACT(EPOCH FROM created_at) * 1000
WHERE position IS NULL;

-- Fix position collisions by adding offset based on created_at order
WITH collision_fix AS (
  SELECT 
    row_id,
    position,
    parent_row_id,
    (ROW_NUMBER() OVER (
      PARTITION BY COALESCE(parent_row_id::text, 'ROOT'), position 
      ORDER BY created_at, row_id
    ) - 1) * 100 as offset
  FROM q_prompts
  WHERE is_deleted = false
)
UPDATE q_prompts p
SET position = p.position + cf.offset
FROM collision_fix cf
WHERE p.row_id = cf.row_id AND cf.offset > 0;

-- Phase 2: Add Lexicographic Column
-- Add the new text column
ALTER TABLE q_prompts ADD COLUMN position_lex TEXT;

-- Convert numeric positions to lexicographic strings
-- Using ROW_NUMBER for deterministic ordering per parent
WITH ordered_prompts AS (
  SELECT 
    row_id,
    parent_row_id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(parent_row_id::text, 'ROOT')
      ORDER BY COALESCE(position, 0), created_at, row_id
    ) as rank
  FROM q_prompts
)
UPDATE q_prompts p
SET position_lex = 'a' || LPAD(op.rank::text, 4, '0')
FROM ordered_prompts op
WHERE p.row_id = op.row_id;

-- Handle any remaining NULL values (should not happen but safety)
UPDATE q_prompts SET position_lex = 'a0001' WHERE position_lex IS NULL;

-- Add NOT NULL constraint and default
ALTER TABLE q_prompts ALTER COLUMN position_lex SET NOT NULL;
ALTER TABLE q_prompts ALTER COLUMN position_lex SET DEFAULT 'a0001';

-- Add index for efficient queries
CREATE INDEX idx_q_prompts_position_lex ON q_prompts(parent_row_id, position_lex);