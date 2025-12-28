/**
 * Template Service
 * 
 * Handles applying and extracting comprehensive template configurations
 * including model settings, action configs, and child creation metadata.
 */

import { getDefaultSchemaById } from '@/config/defaultSchemas';
import { getActionType, getDefaultActionConfig } from '@/config/actionTypes';

/**
 * Apply a template's full configuration to prompt data
 * @param {Object} template - Template with schema, modelConfig, nodeConfig, etc.
 * @param {Object} currentData - Current prompt data to update
 * @returns {Object} Updated fields to apply
 */
export const applyTemplateToPrompt = (template, currentData = {}) => {
  const updates = {};

  // 1. Apply JSON schema to response_format
  if (template.schema) {
    const schemaName = template.id || 'custom_response';
    updates.response_format = JSON.stringify({
      type: 'json_schema',
      json_schema: {
        name: schemaName.toLowerCase().replace(/\s+/g, '_'),
        schema: template.schema,
        strict: true,
      },
    });
  }

  // 2. Apply node type configuration
  if (template.nodeConfig) {
    if (template.nodeConfig.node_type) {
      updates.node_type = template.nodeConfig.node_type;
    }
    if (template.nodeConfig.post_action) {
      updates.post_action = template.nodeConfig.post_action;
    }
  }

  // 3. Apply action configuration (auto-generated from childCreation or explicit)
  if (template.actionConfig) {
    updates.post_action_config = template.actionConfig;
  } else if (template.childCreation?.enabled && template.nodeConfig?.post_action) {
    // Auto-generate action config from childCreation metadata
    const actionConfig = deriveActionConfigFromChildCreation(
      template.nodeConfig.post_action,
      template.childCreation
    );
    if (actionConfig) {
      updates.post_action_config = actionConfig;
    }
  }

  // 4. Apply model configuration
  if (template.modelConfig) {
    if (template.modelConfig.model) {
      updates.model = template.modelConfig.model;
      updates.model_on = true;
    }
    
    // Apply model settings with their enabled flags
    const settingsMap = [
      'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
      'presence_penalty', 'reasoning_effort'
    ];
    
    for (const setting of settingsMap) {
      if (template.modelConfig[setting]?.enabled) {
        updates[setting] = template.modelConfig[setting].value;
        updates[`${setting}_on`] = true;
      }
    }

    // Apply tool settings
    if (template.modelConfig.tools) {
      if (template.modelConfig.tools.web_search !== undefined) {
        updates.web_search_on = template.modelConfig.tools.web_search;
      }
      if (template.modelConfig.tools.confluence !== undefined) {
        updates.confluence_enabled = template.modelConfig.tools.confluence;
      }
      if (template.modelConfig.tools.code_interpreter !== undefined) {
        updates.code_interpreter_on = template.modelConfig.tools.code_interpreter;
      }
      if (template.modelConfig.tools.file_search !== undefined) {
        updates.file_search_on = template.modelConfig.tools.file_search;
      }
    }
  }

  // 5. Apply system prompt template if provided
  if (template.systemPromptTemplate && !currentData.input_admin_prompt) {
    updates.input_admin_prompt = template.systemPromptTemplate;
  }

  return updates;
};

/**
 * Derive action configuration from childCreation metadata
 */
const deriveActionConfigFromChildCreation = (actionId, childCreation) => {
  if (!childCreation) return null;

  const actionType = getActionType(actionId);
  if (!actionType) return null;

  const config = getDefaultActionConfig(actionId);

  switch (actionId) {
    case 'create_children_json':
      if (childCreation.keyPath) config.json_path = childCreation.keyPath;
      if (childCreation.nameField) config.name_field = childCreation.nameField;
      if (childCreation.contentField) config.content_field = childCreation.contentField;
      if (childCreation.childNodeType) config.child_node_type = childCreation.childNodeType;
      break;

    case 'create_children_sections':
      if (childCreation.keyPattern) config.section_pattern = childCreation.keyPattern;
      if (childCreation.nameSource) config.name_source = childCreation.nameSource;
      if (childCreation.contentKeySuffix) config.content_key_suffix = childCreation.contentKeySuffix;
      if (childCreation.placement) config.placement = childCreation.placement;
      if (childCreation.childNodeType) config.child_node_type = childCreation.childNodeType;
      break;

    case 'create_children_text':
      if (childCreation.childNodeType) config.child_node_type = childCreation.childNodeType;
      break;
  }

  return config;
};

/**
 * Extract template configuration from current prompt settings
 * @param {Object} promptData - Current prompt data
 * @returns {Object} Template configuration object
 */
export const extractTemplateFromPrompt = (promptData) => {
  const template = {
    schema: null,
    modelConfig: null,
    nodeConfig: null,
    childCreation: null,
    actionConfig: null,
    systemPromptTemplate: null,
  };

  // 1. Extract JSON schema from response_format
  if (promptData.response_format) {
    try {
      const format = typeof promptData.response_format === 'string'
        ? JSON.parse(promptData.response_format)
        : promptData.response_format;
      
      if (format?.json_schema?.schema) {
        template.schema = format.json_schema.schema;
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  // 2. Extract node configuration
  if (promptData.node_type || promptData.post_action) {
    template.nodeConfig = {
      node_type: promptData.node_type || 'standard',
      post_action: promptData.post_action || null,
    };
  }

  // 3. Extract action configuration
  if (promptData.post_action_config) {
    template.actionConfig = typeof promptData.post_action_config === 'string'
      ? JSON.parse(promptData.post_action_config)
      : promptData.post_action_config;
  }

  // 4. Extract model configuration
  const modelSettings = {};
  let hasModelConfig = false;

  if (promptData.model_on && promptData.model) {
    modelSettings.model = promptData.model;
    hasModelConfig = true;
  }

  const settingsFields = [
    'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
    'presence_penalty', 'reasoning_effort'
  ];

  for (const field of settingsFields) {
    if (promptData[`${field}_on`] && promptData[field]) {
      modelSettings[field] = {
        enabled: true,
        value: promptData[field],
      };
      hasModelConfig = true;
    }
  }

  // Extract tools
  const tools = {};
  if (promptData.web_search_on !== undefined) tools.web_search = promptData.web_search_on;
  if (promptData.confluence_enabled !== undefined) tools.confluence = promptData.confluence_enabled;
  if (promptData.code_interpreter_on !== undefined) tools.code_interpreter = promptData.code_interpreter_on;
  if (promptData.file_search_on !== undefined) tools.file_search = promptData.file_search_on;

  if (Object.keys(tools).length > 0) {
    modelSettings.tools = tools;
    hasModelConfig = true;
  }

  if (hasModelConfig) {
    template.modelConfig = modelSettings;
  }

  // 5. Extract system prompt template
  if (promptData.input_admin_prompt) {
    template.systemPromptTemplate = promptData.input_admin_prompt;
  }

  return template;
};

/**
 * Validate template compatibility with target prompt
 */
export const validateTemplateCompatibility = (template, targetPrompt) => {
  const warnings = [];
  const errors = [];

  // Check if action is available
  if (template.nodeConfig?.post_action) {
    const actionType = getActionType(template.nodeConfig.post_action);
    if (!actionType) {
      errors.push(`Action "${template.nodeConfig.post_action}" is not available`);
    } else if (!actionType.enabled) {
      warnings.push(`Action "${actionType.name}" is currently disabled`);
    }
  }

  // Check if model exists (would need model list to validate)
  if (template.modelConfig?.model) {
    warnings.push('Model will be applied if available');
  }

  return {
    compatible: errors.length === 0,
    warnings,
    errors,
  };
};

/**
 * Get suggested action from schema's childCreation metadata
 */
export const getSuggestedActionFromSchema = (schemaId) => {
  const schema = getDefaultSchemaById(schemaId);
  if (!schema?.childCreation?.enabled) return null;

  // Determine best action based on childCreation structure
  if (schema.childCreation.keyPattern) {
    return 'create_children_sections';
  } else if (schema.childCreation.keyPath) {
    return 'create_children_json';
  }

  return null;
};

/**
 * Check if a schema has full template configuration
 */
export const isFullTemplate = (schemaOrId) => {
  const schema = typeof schemaOrId === 'string' 
    ? getDefaultSchemaById(schemaOrId) 
    : schemaOrId;
  
  return !!(schema?.nodeConfig && schema?.actionConfig);
};
