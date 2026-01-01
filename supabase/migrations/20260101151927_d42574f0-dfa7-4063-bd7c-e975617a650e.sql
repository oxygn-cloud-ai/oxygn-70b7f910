-- 1. Set all prompts to is_assistant = true
UPDATE q_prompts 
SET is_assistant = true 
WHERE is_assistant = false OR is_assistant IS NULL;

-- 2. Create missing assistant records for top-level prompts
INSERT INTO q_assistants (prompt_row_id, name, status, api_version, use_global_tool_defaults)
SELECT p.row_id, p.prompt_name, 'active', 'responses', true
FROM q_prompts p
LEFT JOIN q_assistants a ON a.prompt_row_id = p.row_id
WHERE p.parent_row_id IS NULL 
  AND p.is_deleted = false
  AND a.row_id IS NULL;