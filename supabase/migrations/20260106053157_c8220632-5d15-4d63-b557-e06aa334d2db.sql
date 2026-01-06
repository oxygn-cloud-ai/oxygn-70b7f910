-- Delete the incomplete duplicate gpt-5 record
DELETE FROM q_model_defaults 
WHERE model_id = 'gpt-5' 
AND row_id = 'dedacf6b-d650-44d8-b475-3324c4b20171';

-- Add unique constraint to prevent future duplicates
ALTER TABLE q_model_defaults 
ADD CONSTRAINT q_model_defaults_model_id_unique UNIQUE (model_id);