-- Ensure mutual exclusivity between action and communication node types
-- action node cannot have communication_config set
-- communication node cannot have post_action set

ALTER TABLE q_prompts ADD CONSTRAINT check_node_type_exclusivity 
CHECK (
  NOT (node_type = 'action' AND communication_config IS NOT NULL)
  AND 
  NOT (node_type = 'communication' AND post_action IS NOT NULL)
);