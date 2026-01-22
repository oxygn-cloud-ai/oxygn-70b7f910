/**
 * Template Service
 * 
 * Handles applying and extracting comprehensive template configurations
 * including model settings, action configs, and child creation metadata.
 */

import { getActionType, getDefaultActionConfig } from '@/config/actionTypes';
import { ALL_SETTINGS } from '@/config/modelCapabilities';

// Get all setting keys that can be applied to prompts
const MODEL_SETTINGS_KEYS = Object.keys(ALL_SETTINGS).filter(key => 
  ALL_SETTINGS[key].type !== 'hidden'
);

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
        name: typeof schemaName === 'string' 
          ? schemaName.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
          : 'custom_response',
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
    
    // Apply model settings with their enabled flags (from config)
    for (const setting of MODEL_SETTINGS_KEYS) {
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

  // Use settings keys from config
  for (const field of MODEL_SETTINGS_KEYS) {
    if (promptData[`${field}_on`] && promptData[field]) {
      modelSettings[field] = {
        enabled: true,
        value: promptData[field],
      };
      hasModelConfig = true;
    }
  }

  // Tool settings
  const toolSettings = {};
  let hasTools = false;
  
  if (promptData.web_search_on !== undefined) {
    toolSettings.web_search = promptData.web_search_on;
    hasTools = true;
  }
  if (promptData.confluence_enabled !== undefined) {
    toolSettings.confluence = promptData.confluence_enabled;
    hasTools = true;
  }
  if (promptData.code_interpreter_on !== undefined) {
    toolSettings.code_interpreter = promptData.code_interpreter_on;
    hasTools = true;
  }
  if (promptData.file_search_on !== undefined) {
    toolSettings.file_search = promptData.file_search_on;
    hasTools = true;
  }

  if (hasTools) {
    modelSettings.tools = toolSettings;
    hasModelConfig = true;
  }

  if (hasModelConfig) {
    template.modelConfig = modelSettings;
  }

  // 5. Extract system prompt as template
  if (promptData.input_admin_prompt) {
    template.systemPromptTemplate = promptData.input_admin_prompt;
  }

  return template;
};

/**
 * Check if a template is a "full template" (has node + action config)
 * @param {Object} template - Template object
 * @returns {boolean} True if full template
 */
export const isFullTemplate = (template) => {
  return !!(template?.nodeConfig && template?.actionConfig);
};

/**
 * Get template summary for display
 * @param {Object} template - Template object
 * @returns {Object} Summary with features list
 */
export const getTemplateSummary = (template) => {
  const features = [];
  
  if (template.schema) features.push('JSON Schema');
  if (template.nodeConfig) features.push('Node Type');
  if (template.actionConfig) features.push('Action Config');
  if (template.modelConfig) features.push('Model Settings');
  if (template.systemPromptTemplate) features.push('System Prompt');
  
  return {
    features,
    isFullTemplate: isFullTemplate(template),
    hasChildCreation: template.childCreation?.enabled,
  };
};
