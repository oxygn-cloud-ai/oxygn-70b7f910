/**
 * Resolve System Variables for Prompt Runs
 * 
 * This utility resolves all {{q.xxx}} system variables before a prompt is executed.
 * It handles both static variables (auto-populated) and variables stored on the prompt.
 */

import { SYSTEM_VARIABLES, SYSTEM_VARIABLE_TYPES } from '@/config/systemVariables';

/**
 * Build all system variables for a prompt run
 * @param {Object} options - Options for variable resolution
 * @param {Object} options.promptData - Current prompt data
 * @param {Object} options.parentData - Parent prompt data (if available)
 * @param {Object} options.user - Current user object (from auth context)
 * @param {Object} options.storedVariables - Variables stored on the prompt (from system_variables field)
 * @returns {Object} Resolved system variables map
 */
export const buildSystemVariablesForRun = ({
  promptData = {},
  parentData = null,
  user = null,
  storedVariables = {},
} = {}) => {
  const resolved = {};
  
  // Build context for static variable resolution
  const context = {
    user: user,
    topLevelPromptName: parentData?.prompt_name || promptData?.prompt_name || '',
    parentPromptName: parentData?.prompt_name || '',
  };
  
  // 1. Resolve all static system variables (auto-populated)
  Object.entries(SYSTEM_VARIABLES).forEach(([varName, def]) => {
    if (def.type === SYSTEM_VARIABLE_TYPES.STATIC && def.getValue) {
      try {
        resolved[varName] = def.getValue(context);
      } catch (e) {
        console.warn(`Failed to resolve static variable ${varName}:`, e);
      }
    }
  });
  
  // 2. Add stored variables from the prompt's system_variables field
  // These are user-editable variables like q.policy.version, q.client.name that were set when the prompt was created
  if (storedVariables && typeof storedVariables === 'object') {
    Object.entries(storedVariables).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        resolved[key] = String(value);
      }
    });
  }
  
  // 3. Add prompt context variables
  if (promptData) {
    // Prompt fields that can be referenced
    if (promptData.prompt_name) {
      resolved['q.prompt.name'] = promptData.prompt_name;
    }
    if (promptData.row_id) {
      resolved['q.prompt.id'] = promptData.row_id;
    }
  }
  
  // 4. Add parent context variables
  if (parentData) {
    if (parentData.prompt_name) {
      resolved['q.parent.prompt.name'] = parentData.prompt_name;
    }
    if (parentData.row_id) {
      resolved['q.parent.prompt.id'] = parentData.row_id;
    }
    // Parent's output response (if available)
    if (parentData.output_response) {
      resolved['q.parent.output_response'] = parentData.output_response;
    }
    if (parentData.user_prompt_result) {
      resolved['q.parent.user_prompt_result'] = parentData.user_prompt_result;
    }
  }
  
  return resolved;
};

/**
 * Apply template variable substitution to text
 * @param {string} text - Text containing {{varName}} placeholders
 * @param {Object} variables - Map of variable names to values
 * @returns {string} Text with variables substituted
 */
export const applyTemplateVariables = (text, variables = {}) => {
  if (!text || typeof text !== 'string') return text;
  if (!variables || Object.keys(variables).length === 0) return text;
  
  let result = text;
  
  // Replace all {{varName}} patterns
  Object.entries(variables).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const pattern = new RegExp(`\\{\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    }
  });
  
  return result;
};

/**
 * Extract variable names from text
 * @param {string} text - Text to scan for variables
 * @returns {string[]} Array of variable names found
 */
export const extractVariableNames = (text) => {
  if (!text || typeof text !== 'string') return [];
  
  const pattern = /\{\{([^}]+)\}\}/g;
  const names = [];
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (!names.includes(name)) {
      names.push(name);
    }
  }
  
  return names;
};

export default {
  buildSystemVariablesForRun,
  applyTemplateVariables,
  extractVariableNames,
};
