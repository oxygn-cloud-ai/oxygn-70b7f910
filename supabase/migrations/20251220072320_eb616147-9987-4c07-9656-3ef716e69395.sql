-- Add variable definitions to templates for managing template variables with descriptions, defaults, and types
ALTER TABLE cyg_templates ADD COLUMN IF NOT EXISTS variable_definitions JSONB DEFAULT '[]';
-- Structure: [{ "name": "client", "description": "Client name", "default": "", "type": "text" }]

-- Add index for faster queries on templates
CREATE INDEX IF NOT EXISTS idx_cyg_templates_category ON cyg_templates(category);
CREATE INDEX IF NOT EXISTS idx_cyg_templates_is_deleted ON cyg_templates(is_deleted);