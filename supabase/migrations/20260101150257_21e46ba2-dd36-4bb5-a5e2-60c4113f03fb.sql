-- Deactivate threads with invalid conversation IDs (resp_ or pending-)
UPDATE q_threads 
SET is_active = false 
WHERE (openai_conversation_id LIKE 'resp_%' OR openai_conversation_id LIKE 'pending-%')
  AND is_active = true;