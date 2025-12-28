-- Add comprehensive template configuration columns to q_json_schema_templates
ALTER TABLE q_json_schema_templates 
ADD COLUMN IF NOT EXISTS model_config jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS node_config jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS child_creation jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS action_config jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS system_prompt_template text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN q_json_schema_templates.model_config IS 'Model settings: model ID, temperature, max_tokens, tools, etc.';
COMMENT ON COLUMN q_json_schema_templates.node_config IS 'Node type configuration: standard vs action, post_action selection';
COMMENT ON COLUMN q_json_schema_templates.child_creation IS 'Child creation settings: keyPath, nameField, contentField, placement';
COMMENT ON COLUMN q_json_schema_templates.action_config IS 'Post-action configuration derived from child_creation';
COMMENT ON COLUMN q_json_schema_templates.system_prompt_template IS 'Optional system prompt template with variable placeholders';