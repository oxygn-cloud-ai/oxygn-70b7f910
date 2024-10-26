-- Add position column to prompts table
ALTER TABLE prompts 
ADD COLUMN position DECIMAL(65,30);

-- Create an index on position column for better performance
CREATE INDEX idx_prompts_position ON prompts(position);

-- Initialize positions for existing records
WITH RECURSIVE numbered_rows AS (
  SELECT 
    row_id,
    parent_row_id,
    ROW_NUMBER() OVER (
      PARTITION BY parent_row_id 
      ORDER BY created
    ) * 1000 as new_position
  FROM prompts
  WHERE is_deleted = false
)
UPDATE prompts p
SET position = nr.new_position
FROM numbered_rows nr
WHERE p.row_id = nr.row_id;

-- Make position column NOT NULL after initialization
ALTER TABLE prompts 
ALTER COLUMN position SET NOT NULL;