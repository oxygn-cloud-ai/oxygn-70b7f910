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
        type: CONFIG_FIELD_TYPES.JSON_PATH,
        defaultValue: 'items',
        required: true,
        helpText: 'Path to the array in the JSON response (e.g., "items" or "data.results")',
      },
      {
        key: 'name_field',
        label: 'Name Field',
        type: CONFIG_FIELD_TYPES.TEXT,
        defaultValue: 'name',
        required: false,
        helpText: 'Field in each item to use as node name (e.g., "name", "title")',
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
        key: 'copy_library_prompt_id',
        label: 'Apply Library Prompt',
        type: CONFIG_FIELD_TYPES.SELECT,
        source: 'prompt_library',
        required: false,
        helpText: 'Optional library prompt to apply to each child',
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
