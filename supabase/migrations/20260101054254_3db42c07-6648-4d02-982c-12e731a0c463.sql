-- Phase 1: Database Schema Additions
-- Add library support columns to q_prompt_library
ALTER TABLE q_prompt_library 
  ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contributor_display_name text;

-- Add contributor display name to q_json_schema_templates
ALTER TABLE q_json_schema_templates 
  ADD COLUMN IF NOT EXISTS contributor_display_name text;

-- Add contributor display name to q_templates
ALTER TABLE q_templates 
  ADD COLUMN IF NOT EXISTS contributor_display_name text;

-- Mark existing NULL-owner schema templates as system
UPDATE q_json_schema_templates 
SET contributor_display_name = 'system' 
WHERE owner_id IS NULL;