/**
 * Template Service
 * 
 * Handles applying and extracting comprehensive template configurations
 * including model settings, action configs, and child creation metadata.
 */

import { getActionType, getDefaultActionConfig } from '@/config/actionTypes';
import { ALL_SETTINGS } from '@/config/modelCapabilities';

/**
 * Template schema structure
 */
export interface TemplateSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * Model configuration in a template
 */
export interface TemplateModelConfig {
  model?: string;
  tools?: {
    web_search?: boolean;
    confluence?: boolean;
    code_interpreter?: boolean;
    file_search?: boolean;
  };
  [key: string]: unknown;
}

/**
 * Node configuration in a template
 */
export interface TemplateNodeConfig {
  node_type?: 'standard' | 'action' | 'question';
  post_action?: string | null;
}

/**
 * Child creation metadata
 */
export interface ChildCreationConfig {
  enabled?: boolean;
  keyPath?: string;
  nameField?: string;
  contentField?: string;
  childNodeType?: string;
  keyPattern?: string;
  nameSource?: string;
  contentKeySuffix?: string;
  placement?: string;
}

/**
 * Action configuration
 */
export interface ActionConfig {
  json_path?: string;
  name_field?: string;
  content_field?: string;
  child_node_type?: string;
  section_pattern?: string;
  name_source?: string;
  content_key_suffix?: string;
  placement?: string;
  [key: string]: unknown;
}

/**
 * Complete template structure
 */
export interface Template {
  id?: string;
  schema?: TemplateSchema | null;
  modelConfig?: TemplateModelConfig | null;
  nodeConfig?: TemplateNodeConfig | null;
  childCreation?: ChildCreationConfig | null;
  actionConfig?: ActionConfig | null;
  systemPromptTemplate?: string | null;
}

/**
 * Prompt data for template operations
 */
export interface PromptDataForTemplate {
  response_format?: string | Record<string, unknown>;
  node_type?: string;
  post_action?: string | null;
  post_action_config?: string | Record<string, unknown>;
  model?: string;
  model_on?: boolean;
  input_admin_prompt?: string;
  web_search_on?: boolean;
  confluence_enabled?: boolean;
  code_interpreter_on?: boolean;
  file_search_on?: boolean;
  [key: string]: unknown;
}

/**
 * Template application result
 */
export interface TemplateUpdates {
  response_format?: string;
  node_type?: string;
  post_action?: string;
  post_action_config?: ActionConfig;
  model?: string;
  model_on?: boolean;
  input_admin_prompt?: string;
  web_search_on?: boolean;
  confluence_enabled?: boolean;
  code_interpreter_on?: boolean;
  file_search_on?: boolean;
  [key: string]: unknown;
}

// Get all setting keys that can be applied to prompts
const MODEL_SETTINGS_KEYS = Object.keys(ALL_SETTINGS).filter(key => 
  (ALL_SETTINGS as Record<string, { type: string }>)[key].type !== 'hidden'
);

/**
 * Apply a template's full configuration to prompt data
 * @param template - Template with schema, modelConfig, nodeConfig, etc.
 * @param currentData - Current prompt data to update
 * @returns Updated fields to apply
 */
export const applyTemplateToPrompt = (
  template: Template, 
  currentData: PromptDataForTemplate = {}
): TemplateUpdates => {
  const updates: TemplateUpdates = {};

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
      const settingConfig = template.modelConfig[setting] as { enabled?: boolean; value?: unknown } | undefined;
      if (settingConfig?.enabled) {
        updates[setting] = settingConfig.value;
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
const deriveActionConfigFromChildCreation = (
  actionId: string, 
  childCreation: ChildCreationConfig
): ActionConfig | null => {
  if (!childCreation) return null;

  const actionType = getActionType(actionId);
  if (!actionType) return null;

  const config = getDefaultActionConfig(actionId) as ActionConfig;

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
 * @param promptData - Current prompt data
 * @returns Template configuration object
 */
export const extractTemplateFromPrompt = (promptData: PromptDataForTemplate): Template => {
  const template: Template = {
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
        template.schema = format.json_schema.schema as TemplateSchema;
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  // 2. Extract node configuration
  if (promptData.node_type || promptData.post_action) {
    template.nodeConfig = {
      node_type: (promptData.node_type as TemplateNodeConfig['node_type']) || 'standard',
      post_action: promptData.post_action || null,
    };
  }

  // 3. Extract action configuration
  if (promptData.post_action_config) {
    template.actionConfig = typeof promptData.post_action_config === 'string'
      ? JSON.parse(promptData.post_action_config)
      : promptData.post_action_config as ActionConfig;
  }

  // 4. Extract model configuration
  const modelSettings: TemplateModelConfig = {};
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
  const toolSettings: NonNullable<TemplateModelConfig['tools']> = {};
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
 * @param template - Template object
 * @returns True if full template
 */
export const isFullTemplate = (template: Template | null | undefined): boolean => {
  return !!(template?.nodeConfig && template?.actionConfig);
};

/**
 * Template summary for display
 */
export interface TemplateSummary {
  features: string[];
  isFullTemplate: boolean;
  hasChildCreation: boolean;
}

/**
 * Get template summary for display
 * @param template - Template object
 * @returns Summary with features list
 */
export const getTemplateSummary = (template: Template): TemplateSummary => {
  const features: string[] = [];
  
  if (template.schema) features.push('JSON Schema');
  if (template.nodeConfig) features.push('Node Type');
  if (template.actionConfig) features.push('Action Config');
  if (template.modelConfig) features.push('Model Settings');
  if (template.systemPromptTemplate) features.push('System Prompt');
  
  return {
    features,
    isFullTemplate: isFullTemplate(template),
    hasChildCreation: !!template.childCreation?.enabled,
  };
};
