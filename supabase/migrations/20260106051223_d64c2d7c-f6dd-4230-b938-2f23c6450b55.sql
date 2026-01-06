-- Complete Workbench Removal Migration
-- This migration removes all workbench-related database objects

-- Drop workbench tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS q_workbench_confluence_links CASCADE;
DROP TABLE IF EXISTS q_workbench_files CASCADE;
DROP TABLE IF EXISTS q_workbench_messages CASCADE;
DROP TABLE IF EXISTS q_workbench_threads CASCADE;

-- Delete workbench-related settings
DELETE FROM q_settings WHERE setting_key IN (
  'workbench_system_prompt',
  'workbench_confluence_enabled',
  'workbench_default_model',
  'workbench_max_context_messages',
  'workbench_file_search',
  'workbench_code_interpreter',
  'workbench_auto_save'
);

-- Delete workbench knowledge entries
DELETE FROM q_app_knowledge WHERE topic = 'workbench';

-- Update knowledge entry that mentions workbench in content to remove that reference
UPDATE q_app_knowledge 
SET content = REPLACE(content, 'Workbench', '')
WHERE content ILIKE '%workbench%';

-- Delete storage bucket objects (if any exist) - this is handled by cascade on the table drop
-- The bucket itself cannot be deleted via SQL migration, but with the tables gone, 
-- the storage integration is effectively disabled

-- Note: The workbench-files storage bucket will remain empty but cannot be deleted via SQL.
-- This is safe as no code will reference it after this cleanup.