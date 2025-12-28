/**
 * Action Types Registry
 * 
 * Extensible framework for defining action node behaviors.
 * Each action type defines its metadata, configuration schema, and UI properties.
 */

export const ACTION_CATEGORIES = {
  structure: {
    id: 'structure',
    name: 'Structure',
    description: 'Actions that modify the node tree structure',
    icon: 'GitBranch',
  },
  ai: {
    id: 'ai',
    name: 'AI Operations',
    description: 'Actions that involve AI processing',
    icon: 'Brain',
  },
  integration: {
    id: 'integration',
    name: 'Integrations',
    description: 'Actions that connect to external services',
    icon: 'Plug',
  },
};

/**
 * Configuration field types for dynamic UI rendering
 */
export const CONFIG_FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  TEXTAREA: 'textarea',
  BOOLEAN: 'boolean',
  JSON_PATH: 'json_path',
  SCHEMA_KEYS: 'schema_keys',     // Visual key picker from current schema
  MODEL_SELECT: 'model_select',   // Model dropdown
  NODE_TYPE: 'node_type',         // standard vs action
};

/**
 * Action Types Registry
 * 
 * Each action type defines:
 * - id: Unique identifier stored in database
 * - name: Display name
 * - description: Help text for users
 * - icon: Lucide icon name
 * - category: One of ACTION_CATEGORIES keys
 * - configSchema: Array of configuration fields
 * - enabled: Whether this action is currently available
 */
export const ACTION_TYPES = {
  create_children_text: {
    id: 'create_children_text',
    name: 'Create Children (Text)',
    description: 'Create a specified number of child nodes with text content',
    icon: 'GitBranch',
    category: 'structure',
    enabled: true,
    configSchema: [
      {
        key: 'children_count',
        label: 'Number of Children',
        type: CONFIG_FIELD_TYPES.NUMBER,
        defaultValue: 3,
        min: 1,
        max: 20,
        required: true,
        helpText: 'How many child nodes to create',
      },
      {
        key: 'name_prefix',
        label: 'Name Prefix',
        type: CONFIG_FIELD_TYPES.TEXT,
        defaultValue: 'Child',
        required: false,
        helpText: 'Prefix for child node names (e.g., "Child 1", "Child 2")',
      },
      {
        key: 'placement',
        label: 'Prompt Placement',
        type: CONFIG_FIELD_TYPES.SELECT,
        options: ['children', 'siblings', 'top_level'],
        defaultValue: 'children',
        required: true,
        helpText: 'Where to create prompts: as children of this prompt, as siblings, or as top-level prompts',
      },
      {
        key: 'child_node_type',
        label: 'Child Node Type',
        type: CONFIG_FIELD_TYPES.SELECT,
        options: ['standard', 'action'],
        defaultValue: 'standard',
        required: false,
        helpText: 'Create standard prompts or action nodes',
      },
      {
        key: 'copy_library_prompt_id',
        label: 'Apply Library Prompt',
        type: CONFIG_FIELD_TYPES.SELECT,
        source: 'prompt_library',
        required: false,
        helpText: 'Optional library prompt to apply to each child',
      },
    ],
  },

  create_children_json: {
    id: 'create_children_json',
    name: 'Create Children (JSON)',
    description: 'Create child nodes from a JSON array in the AI response',
    icon: 'Braces',
    category: 'structure',
    enabled: true,
    configSchema: [
      {
        key: 'json_path',
        label: 'JSON Array Path',
        type: CONFIG_FIELD_TYPES.SCHEMA_KEYS,
        defaultValue: 'items',
        required: true,
        helpText: 'Select which array in the JSON response to use for creating children',
        fallbackType: CONFIG_FIELD_TYPES.JSON_PATH,
      },
      {
        key: 'name_field',
        label: 'Name Field',
        type: CONFIG_FIELD_TYPES.TEXT,
        defaultValue: '',
        required: false,
        helpText: 'JSON path to the field to use as node name (e.g., "name", "title", "heading"). Leave empty for auto-detection.',
      },
      {
        key: 'content_field',
        label: 'Content Field',
        type: CONFIG_FIELD_TYPES.TEXT,
        defaultValue: '',
        required: false,
        helpText: 'Field to use as user prompt content (leave empty to use entire item)',
      },
      {
        key: 'placement',
        label: 'Prompt Placement',
        type: CONFIG_FIELD_TYPES.SELECT,
        options: ['children', 'siblings', 'top_level'],
        defaultValue: 'children',
        required: true,
        helpText: 'Where to create prompts: as children of this prompt, as siblings, or as top-level prompts',
      },
      {
        key: 'child_node_type',
        label: 'Child Node Type',
        type: CONFIG_FIELD_TYPES.SELECT,
        options: ['standard', 'action'],
        defaultValue: 'standard',
        required: false,
        helpText: 'Create standard prompts or action nodes',
      },
      {
        key: 'copy_library_prompt_id',
        label: 'Apply Library Prompt',
        type: CONFIG_FIELD_TYPES.SELECT,
        source: 'prompt_library',
        required: false,
        helpText: 'Optional library prompt to apply to each child',
      },
    ],
  },

  create_children_sections: {
    id: 'create_children_sections',
    name: 'Create Children (Sections)',
    description: 'Create child nodes from JSON keys matching "section nn" pattern (e.g., "section 01", "section 02")',
    icon: 'ListTree',
    category: 'structure',
    enabled: true,
    configSchema: [
      {
        key: 'target_keys',
        label: 'Keys to Convert',
        type: CONFIG_FIELD_TYPES.SCHEMA_KEYS,
        defaultValue: [],
        required: false,
        helpText: 'Select which JSON keys should become child prompts (leave empty to use pattern)',
        fallbackPattern: '^section\\s*\\d+',
      },
      {
        key: 'section_pattern',
        label: 'Section Key Pattern (fallback)',
        type: CONFIG_FIELD_TYPES.TEXT,
        defaultValue: '^section\\s*\\d+',
        required: false,
        helpText: 'Regex pattern to match section keys when no keys are selected above',
      },
      {
        key: 'name_source',
        label: 'Prompt Name Source',
        type: CONFIG_FIELD_TYPES.SELECT,
        options: ['key_value', 'key_name', 'both'],
        defaultValue: 'key_value',
        required: true,
        helpText: 'Use the key value as name, the key itself, or "Key: Value" format',
      },
      {
        key: 'content_key_suffix',
        label: 'Content Key Suffix',
        type: CONFIG_FIELD_TYPES.TEXT,
        defaultValue: 'system prompt',
        required: false,
        helpText: 'Look for matching keys with this suffix for content (e.g., "section 01 system prompt")',
      },
      {
        key: 'placement',
        label: 'Prompt Placement',
        type: CONFIG_FIELD_TYPES.SELECT,
        options: ['children', 'siblings', 'top_level'],
        defaultValue: 'children',
        required: true,
        helpText: 'Where to create the new prompts: as children of this prompt, at the same level, or as top-level prompts',
      },
      {
        key: 'child_node_type',
        label: 'Child Node Type',
        type: CONFIG_FIELD_TYPES.SELECT,
        options: ['standard', 'action'],
        defaultValue: 'standard',
        required: false,
        helpText: 'Create standard prompts or action nodes',
      },
      {
        key: 'copy_library_prompt_id',
        label: 'Apply Library Prompt',
        type: CONFIG_FIELD_TYPES.SELECT,
        source: 'prompt_library',
        required: false,
        helpText: 'Optional library prompt to apply to each created prompt',
      },
    ],
  },

  create_template: {
    id: 'create_template',
    name: 'Create Template',
    description: 'Save the current node structure as a reusable template',
    icon: 'LayoutTemplate',
    category: 'structure',
    enabled: true,
    configSchema: [
      {
        key: 'template_name',
        label: 'Template Name',
        type: CONFIG_FIELD_TYPES.TEXT,
        defaultValue: '',
        required: true,
        helpText: 'Name for the new template',
      },
      {
        key: 'template_description',
        label: 'Description',
        type: CONFIG_FIELD_TYPES.TEXTAREA,
        defaultValue: '',
        required: false,
        helpText: 'Optional description of the template',
      },
      {
        key: 'include_children',
        label: 'Include Children',
        type: CONFIG_FIELD_TYPES.BOOLEAN,
        defaultValue: true,
        required: false,
        helpText: 'Include child nodes in the template',
      },
    ],
  },

  // Future action types (disabled for now)
  recursive_chat: {
    id: 'recursive_chat',
    name: 'Recursive Chat',
    description: 'Continue chatting with AI based on response conditions',
    icon: 'MessageSquareMore',
    category: 'ai',
    enabled: false, // Not implemented yet
    configSchema: [
      {
        key: 'max_iterations',
        label: 'Max Iterations',
        type: CONFIG_FIELD_TYPES.NUMBER,
        defaultValue: 5,
        min: 1,
        max: 10,
        required: true,
      },
      {
        key: 'stop_condition',
        label: 'Stop Condition',
        type: CONFIG_FIELD_TYPES.TEXT,
        defaultValue: '',
        required: false,
        helpText: 'JSON path to boolean field that stops iteration when true',
      },
    ],
  },

  create_jira_ticket: {
    id: 'create_jira_ticket',
    name: 'Create Jira Ticket',
    description: 'Create a Jira ticket from the AI response',
    icon: 'Ticket',
    category: 'integration',
    enabled: false, // Not implemented yet
    configSchema: [
      {
        key: 'project_key',
        label: 'Project Key',
        type: CONFIG_FIELD_TYPES.TEXT,
        required: true,
      },
      {
        key: 'issue_type',
        label: 'Issue Type',
        type: CONFIG_FIELD_TYPES.SELECT,
        options: ['Task', 'Story', 'Bug', 'Epic'],
        defaultValue: 'Task',
        required: true,
      },
    ],
  },

  call_webhook: {
    id: 'call_webhook',
    name: 'Call Webhook',
    description: 'Send the AI response to an external webhook',
    icon: 'Webhook',
    category: 'integration',
    enabled: false, // Not implemented yet
    configSchema: [
      {
        key: 'webhook_url',
        label: 'Webhook URL',
        type: CONFIG_FIELD_TYPES.TEXT,
        required: true,
      },
      {
        key: 'method',
        label: 'HTTP Method',
        type: CONFIG_FIELD_TYPES.SELECT,
        options: ['POST', 'PUT', 'PATCH'],
        defaultValue: 'POST',
        required: true,
      },
    ],
  },
};

/**
 * Get all enabled action types
 */
export const getEnabledActionTypes = () => {
  return Object.values(ACTION_TYPES).filter(action => action.enabled);
};

/**
 * Get action types by category
 */
export const getActionTypesByCategory = (categoryId) => {
  return Object.values(ACTION_TYPES).filter(
    action => action.enabled && action.category === categoryId
  );
};

/**
 * Get a specific action type by ID
 */
export const getActionType = (actionId) => {
  return ACTION_TYPES[actionId] || null;
};

/**
 * Validate action configuration against schema
 */
export const validateActionConfig = (actionId, config) => {
  const actionType = getActionType(actionId);
  if (!actionType) return { valid: false, errors: ['Unknown action type'] };

  const errors = [];
  
  for (const field of actionType.configSchema) {
    if (field.required && !config?.[field.key]) {
      errors.push(`${field.label} is required`);
    }
    
    if (field.type === CONFIG_FIELD_TYPES.NUMBER && config?.[field.key] !== undefined) {
      const value = Number(config[field.key]);
      if (isNaN(value)) {
        errors.push(`${field.label} must be a number`);
      } else {
        if (field.min !== undefined && value < field.min) {
          errors.push(`${field.label} must be at least ${field.min}`);
        }
        if (field.max !== undefined && value > field.max) {
          errors.push(`${field.label} must be at most ${field.max}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Get default configuration for an action type
 */
export const getDefaultActionConfig = (actionId) => {
  const actionType = getActionType(actionId);
  if (!actionType) return {};

  const config = {};
  for (const field of actionType.configSchema) {
    if (field.defaultValue !== undefined) {
      config[field.key] = field.defaultValue;
    }
  }
  return config;
};
