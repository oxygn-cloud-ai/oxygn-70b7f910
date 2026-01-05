-- Remove stale context variables from system_variables JSONB
-- These variables should be resolved at runtime, not stored as snapshots
UPDATE q_prompts
SET system_variables = system_variables 
  - 'q.policy.name'
  - 'q.prompt.name' 
  - 'q.toplevel.prompt.name'
  - 'q.parent.prompt.name'
  - 'q.parent.prompt.id'
  - 'q.parent_output'
  - 'q.today'
  - 'q.now'
  - 'q.year'
  - 'q.month'
  - 'q.user.name'
  - 'q.user.email'
WHERE system_variables IS NOT NULL
  AND system_variables != '{}'::jsonb;