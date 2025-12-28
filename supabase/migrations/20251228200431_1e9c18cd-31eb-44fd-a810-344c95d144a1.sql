-- Insert all built-in JSON schema templates into the database
-- These templates will be available to all users (owner_id is null, is_private is false)

INSERT INTO public.q_json_schema_templates (
  schema_name, schema_description, category, json_schema, 
  node_config, child_creation, action_config, model_config, 
  system_prompt_template, is_private, is_deleted
) VALUES
-- ==================== ACTION TEMPLATES ====================
(
  'Sections → Children',
  'Generate numbered sections that automatically create child prompts',
  'action',
  '{"type":"object","properties":{"section_01":{"type":"string","description":"Title/name for section 1"},"section_01_system_prompt":{"type":"string","description":"System prompt content for section 1"},"section_02":{"type":"string","description":"Title/name for section 2"},"section_02_system_prompt":{"type":"string","description":"System prompt content for section 2"},"section_03":{"type":"string","description":"Title/name for section 3"},"section_03_system_prompt":{"type":"string","description":"System prompt content for section 3"}},"required":["section_01"],"additionalProperties":true}'::jsonb,
  '{"node_type":"action","post_action":"create_children_sections"}'::jsonb,
  '{"enabled":true,"keyPattern":"^section_\\\\d+$","nameSource":"key_value","contentKeySuffix":"_system_prompt","placement":"children","inheritModel":true,"childNodeType":"standard"}'::jsonb,
  '{"section_pattern":"^section_\\\\d+$","name_source":"key_value","content_key_suffix":"_system_prompt","placement":"children"}'::jsonb,
  '{"model":null,"temperature":{"enabled":true,"value":"0.7"},"max_tokens":{"enabled":false}}'::jsonb,
  'Generate numbered sections for {{topic}}. Create section_01, section_02, etc. with corresponding system prompts.',
  false, false
),
(
  'Goals → Child Prompts',
  'SMART goals array that creates child prompts per goal',
  'action',
  '{"type":"object","properties":{"goals":{"type":"array","description":"SMART goals to create as child prompts","items":{"type":"object","properties":{"title":{"type":"string","description":"Goal title (becomes prompt name)"},"description":{"type":"string","description":"Goal description (becomes system prompt)"},"success_criteria":{"type":"string","description":"How to measure success"},"deadline":{"type":"string","description":"Target completion date"}},"required":["title","description"],"additionalProperties":false}}},"required":["goals"],"additionalProperties":false}'::jsonb,
  '{"node_type":"action","post_action":"create_children_json"}'::jsonb,
  '{"enabled":true,"keyPath":"goals","nameField":"title","contentField":"description","placement":"children","inheritModel":true,"childNodeType":"standard"}'::jsonb,
  '{"json_path":"goals","name_field":"title","content_field":"description"}'::jsonb,
  '{"model":null,"temperature":{"enabled":true,"value":"0.5"}}'::jsonb,
  'Generate SMART goals for {{topic}}. Each goal needs a clear title and description.',
  false, false
),
(
  'Tasks → Action Prompts',
  'Generate tasks that become action node children',
  'action',
  '{"type":"object","properties":{"tasks":{"type":"array","description":"Tasks to create as action node children","items":{"type":"object","properties":{"name":{"type":"string","description":"Task name"},"system_prompt":{"type":"string","description":"System prompt for the action"},"expected_output_schema":{"type":"string","description":"Brief description of expected JSON output"}},"required":["name","system_prompt"],"additionalProperties":false}}},"required":["tasks"],"additionalProperties":false}'::jsonb,
  '{"node_type":"action","post_action":"create_children_json"}'::jsonb,
  '{"enabled":true,"keyPath":"tasks","nameField":"name","contentField":"system_prompt","placement":"children","inheritModel":true,"childNodeType":"action"}'::jsonb,
  '{"json_path":"tasks","name_field":"name","content_field":"system_prompt","child_node_type":"action"}'::jsonb,
  '{"model":null,"temperature":{"enabled":true,"value":"0.3"}}'::jsonb,
  null,
  false, false
),
(
  'Research Topics → Siblings',
  'Generate research topics as sibling prompts for parallel execution',
  'action',
  '{"type":"object","properties":{"topics":{"type":"array","description":"Research topics to explore in parallel","items":{"type":"object","properties":{"title":{"type":"string","description":"Topic title"},"focus_areas":{"type":"string","description":"Key areas to research"},"questions":{"type":"array","items":{"type":"string"},"description":"Key questions to answer"}},"required":["title","focus_areas"],"additionalProperties":false}}},"required":["topics"],"additionalProperties":false}'::jsonb,
  '{"node_type":"action","post_action":"create_children_sections"}'::jsonb,
  '{"enabled":true,"keyPath":"topics","nameField":"title","contentField":"focus_areas","placement":"siblings","inheritModel":true,"childNodeType":"standard"}'::jsonb,
  '{"json_path":"topics","name_field":"title","content_field":"focus_areas","placement":"siblings"}'::jsonb,
  '{"model":null,"temperature":{"enabled":true,"value":"0.8"}}'::jsonb,
  null,
  false, false
),
(
  'Default Child Creation',
  'Standard template for creating child prompts from JSON output. Use prompt_name for naming and input_admin_prompt for content.',
  'action',
  '{"type":"object","properties":{"children":{"type":"array","description":"Array of child prompts to create","items":{"type":"object","properties":{"prompt_name":{"type":"string","description":"Name for the child prompt (becomes the prompt title)"},"input_admin_prompt":{"type":"string","description":"System prompt content for the child (becomes the admin/system prompt)"},"input_user_prompt":{"type":"string","description":"Optional user prompt content for the child"}},"required":["prompt_name","input_admin_prompt"],"additionalProperties":false}}},"required":["children"],"additionalProperties":false}'::jsonb,
  '{"node_type":"action","post_action":"create_children_json"}'::jsonb,
  '{"enabled":true,"keyPath":"children","nameField":"prompt_name","contentField":"input_admin_prompt","placement":"children","inheritModel":true,"childNodeType":"standard"}'::jsonb,
  '{"json_path":"children","name_field":"prompt_name","content_field":"input_admin_prompt","placement":"children"}'::jsonb,
  '{"model":null,"temperature":{"enabled":true,"value":"0.7"}}'::jsonb,
  'Generate child prompts for {{topic}}. Each child needs a prompt_name (title) and input_admin_prompt (system instructions).',
  false, false
),
(
  'Create Children (Simple)',
  'Schema for creating child nodes with name and content',
  'action',
  '{"type":"object","properties":{"items":{"type":"array","description":"Array of items to create as child nodes","items":{"type":"object","properties":{"name":{"type":"string","description":"Name for the child node"},"content":{"type":"string","description":"Content for the child node"}},"required":["name","content"],"additionalProperties":false}}},"required":["items"],"additionalProperties":false}'::jsonb,
  null,
  '{"enabled":true,"keyPath":"items","nameField":"name","contentField":"content"}'::jsonb,
  null, null, null,
  false, false
),
-- ==================== PLANNING TEMPLATES ====================
(
  'Goal Setting (SMART)',
  'SMART goals with objectives, key results, and milestones',
  'planning',
  '{"type":"object","properties":{"vision":{"type":"string","description":"High-level vision statement"},"goals":{"type":"array","description":"SMART goals","items":{"type":"object","properties":{"title":{"type":"string","description":"Goal title"},"description":{"type":"string","description":"Detailed goal description"},"specific":{"type":"string","description":"What exactly will be accomplished?"},"measurable":{"type":"string","description":"How will progress be measured?"},"achievable":{"type":"string","description":"Is this realistic?"},"relevant":{"type":"string","description":"Why does this matter?"},"time_bound":{"type":"string","description":"Target completion date"},"key_results":{"type":"array","items":{"type":"string"},"description":"Measurable key results"},"priority":{"type":"string","enum":["critical","high","medium","low"]}},"required":["title","description","key_results","time_bound"],"additionalProperties":false}},"milestones":{"type":"array","description":"Key milestones to track progress","items":{"type":"object","properties":{"name":{"type":"string"},"target_date":{"type":"string"},"success_criteria":{"type":"string"}},"required":["name","target_date"],"additionalProperties":false}}},"required":["goals"],"additionalProperties":false}'::jsonb,
  null,
  '{"enabled":true,"keyPath":"goals","nameField":"title","contentField":"description"}'::jsonb,
  null, null, null,
  false, false
),
(
  'OKRs (Objectives & Key Results)',
  'Objectives with measurable key results',
  'planning',
  '{"type":"object","properties":{"time_period":{"type":"string","description":"e.g., Q1 2025"},"objectives":{"type":"array","items":{"type":"object","properties":{"objective":{"type":"string","description":"Qualitative goal statement"},"owner":{"type":"string","description":"Person or team responsible"},"key_results":{"type":"array","items":{"type":"object","properties":{"description":{"type":"string"},"metric":{"type":"string","description":"How it will be measured"},"target":{"type":"string","description":"Target value"},"current":{"type":"string","description":"Current baseline"}},"required":["description","target"],"additionalProperties":false}}},"required":["objective","key_results"],"additionalProperties":false}}},"required":["objectives"],"additionalProperties":false}'::jsonb,
  null,
  '{"enabled":true,"keyPath":"objectives","nameField":"objective","contentField":null}'::jsonb,
  null, null, null,
  false, false
),
(
  'Project Plan',
  'Project structure with phases, tasks, and dependencies',
  'planning',
  '{"type":"object","properties":{"project_name":{"type":"string"},"objective":{"type":"string"},"start_date":{"type":"string"},"end_date":{"type":"string"},"team":{"type":"array","items":{"type":"string"}},"phases":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"description":{"type":"string"},"duration":{"type":"string"},"tasks":{"type":"array","items":{"type":"object","properties":{"title":{"type":"string"},"assignee":{"type":"string"},"effort":{"type":"string"},"dependencies":{"type":"array","items":{"type":"string"}}},"required":["title"],"additionalProperties":false}},"deliverables":{"type":"array","items":{"type":"string"}}},"required":["name","tasks"],"additionalProperties":false}},"risks":{"type":"array","items":{"type":"object","properties":{"risk":{"type":"string"},"likelihood":{"type":"string","enum":["high","medium","low"]},"mitigation":{"type":"string"}},"required":["risk"],"additionalProperties":false}},"success_criteria":{"type":"array","items":{"type":"string"}}},"required":["project_name","phases"],"additionalProperties":false}'::jsonb,
  null,
  '{"enabled":true,"keyPath":"phases","nameField":"name","contentField":"description"}'::jsonb,
  null, null, null,
  false, false
),
-- ==================== ANALYSIS TEMPLATES ====================
(
  'SWOT Analysis',
  'Strengths, Weaknesses, Opportunities, Threats',
  'analysis',
  '{"type":"object","properties":{"subject":{"type":"string","description":"What is being analyzed"},"strengths":{"type":"array","items":{"type":"object","properties":{"point":{"type":"string"},"impact":{"type":"string","enum":["high","medium","low"]}},"required":["point"],"additionalProperties":false}},"weaknesses":{"type":"array","items":{"type":"object","properties":{"point":{"type":"string"},"impact":{"type":"string","enum":["high","medium","low"]}},"required":["point"],"additionalProperties":false}},"opportunities":{"type":"array","items":{"type":"object","properties":{"point":{"type":"string"},"potential":{"type":"string","enum":["high","medium","low"]}},"required":["point"],"additionalProperties":false}},"threats":{"type":"array","items":{"type":"object","properties":{"point":{"type":"string"},"severity":{"type":"string","enum":["high","medium","low"]}},"required":["point"],"additionalProperties":false}},"recommendations":{"type":"array","items":{"type":"string"}}},"required":["strengths","weaknesses","opportunities","threats"],"additionalProperties":false}'::jsonb,
  null, null, null, null, null,
  false, false
),
(
  'Structured Analysis',
  'Analysis with summary, findings, and recommendations',
  'analysis',
  '{"type":"object","properties":{"summary":{"type":"string","description":"Brief summary of the analysis"},"findings":{"type":"array","description":"Key findings from the analysis","items":{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"importance":{"type":"string","enum":["low","medium","high"]}},"required":["title","description","importance"],"additionalProperties":false}},"recommendations":{"type":"array","description":"Actionable recommendations","items":{"type":"string"}}},"required":["summary","findings","recommendations"],"additionalProperties":false}'::jsonb,
  null,
  '{"enabled":true,"keyPath":"findings","nameField":"title","contentField":"description"}'::jsonb,
  null, null, null,
  false, false
),
(
  'Decision Matrix',
  'Compare options with weighted criteria',
  'analysis',
  '{"type":"object","properties":{"decision":{"type":"string","description":"What decision is being made"},"criteria":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"weight":{"type":"number","description":"1-10 importance"},"description":{"type":"string"}},"required":["name","weight"],"additionalProperties":false}},"options":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"scores":{"type":"array","items":{"type":"object","properties":{"criterion":{"type":"string"},"score":{"type":"number","description":"1-10 rating"},"rationale":{"type":"string"}},"required":["criterion","score"],"additionalProperties":false}},"total_score":{"type":"number"},"pros":{"type":"array","items":{"type":"string"}},"cons":{"type":"array","items":{"type":"string"}}},"required":["name","scores"],"additionalProperties":false}},"recommendation":{"type":"string"}},"required":["decision","criteria","options"],"additionalProperties":false}'::jsonb,
  null,
  '{"enabled":true,"keyPath":"options","nameField":"name","contentField":null}'::jsonb,
  null, null, null,
  false, false
),
-- ==================== EXTRACTION TEMPLATES ====================
(
  'Company Profile',
  'Structured company information extraction',
  'extraction',
  '{"type":"object","properties":{"company_name":{"type":"string"},"industry":{"type":"string"},"founded":{"type":"string"},"headquarters":{"type":"string"},"mission":{"type":"string"},"vision":{"type":"string"},"values":{"type":"array","items":{"type":"string"}},"products_services":{"type":"array","items":{"type":"string"}},"target_market":{"type":"string"},"competitive_advantages":{"type":"array","items":{"type":"string"}},"key_challenges":{"type":"array","items":{"type":"string"}},"growth_opportunities":{"type":"array","items":{"type":"string"}}},"required":["company_name"],"additionalProperties":false}'::jsonb,
  null, null, null, null, null,
  false, false
),
(
  'Person Profile',
  'Structured profile for individuals',
  'extraction',
  '{"type":"object","properties":{"name":{"type":"string"},"role":{"type":"string"},"organization":{"type":"string"},"background":{"type":"string","description":"Brief professional background"},"expertise":{"type":"array","items":{"type":"string"}},"achievements":{"type":"array","items":{"type":"string"}},"goals":{"type":"array","items":{"type":"string"}},"challenges":{"type":"array","items":{"type":"string"}},"communication_style":{"type":"string"},"decision_factors":{"type":"array","items":{"type":"string"},"description":"What influences their decisions"}},"required":["name"],"additionalProperties":false}'::jsonb,
  null, null, null, null, null,
  false, false
),
(
  'Key-Value Pairs',
  'Schema for extracting key-value data',
  'extraction',
  '{"type":"object","properties":{"data":{"type":"array","description":"Array of key-value pairs","items":{"type":"object","properties":{"key":{"type":"string","description":"The key/field name"},"value":{"type":"string","description":"The value for this key"}},"required":["key","value"],"additionalProperties":false}}},"required":["data"],"additionalProperties":false}'::jsonb,
  null,
  '{"enabled":true,"keyPath":"data","nameField":"key","contentField":"value"}'::jsonb,
  null, null, null,
  false, false
),
(
  'Simple List',
  'Schema for a simple string array',
  'extraction',
  '{"type":"object","properties":{"items":{"type":"array","description":"List of items","items":{"type":"string"}}},"required":["items"],"additionalProperties":false}'::jsonb,
  null,
  '{"enabled":true,"keyPath":"items","nameField":null,"contentField":null}'::jsonb,
  null, null, null,
  false, false
),
-- ==================== OTHER TEMPLATES ====================
(
  'Meeting Notes',
  'Structured meeting summary with action items',
  'action',
  '{"type":"object","properties":{"title":{"type":"string"},"date":{"type":"string"},"attendees":{"type":"array","items":{"type":"string"}},"summary":{"type":"string","description":"Brief meeting summary"},"key_discussions":{"type":"array","items":{"type":"object","properties":{"topic":{"type":"string"},"points":{"type":"array","items":{"type":"string"}},"decisions":{"type":"array","items":{"type":"string"}}},"required":["topic"],"additionalProperties":false}},"action_items":{"type":"array","items":{"type":"object","properties":{"task":{"type":"string"},"owner":{"type":"string"},"due_date":{"type":"string"},"priority":{"type":"string","enum":["high","medium","low"]}},"required":["task","owner"],"additionalProperties":false}},"next_steps":{"type":"array","items":{"type":"string"}}},"required":["summary","action_items"],"additionalProperties":false}'::jsonb,
  null,
  '{"enabled":true,"keyPath":"action_items","nameField":"task","contentField":null}'::jsonb,
  null, null, null,
  false, false
),
(
  'Task List',
  'Schema for generating task lists',
  'action',
  '{"type":"object","properties":{"tasks":{"type":"array","description":"List of tasks","items":{"type":"object","properties":{"title":{"type":"string","description":"Task title"},"description":{"type":"string","description":"Detailed task description"},"priority":{"type":"string","enum":["low","medium","high"],"description":"Task priority"},"estimated_hours":{"type":"number","description":"Estimated hours to complete"}},"required":["title","description","priority"],"additionalProperties":false}}},"required":["tasks"],"additionalProperties":false}'::jsonb,
  null,
  '{"enabled":true,"keyPath":"tasks","nameField":"title","contentField":"description"}'::jsonb,
  null, null, null,
  false, false
);