/**
 * Resolve System Variables for Prompt Runs
 * 
 * This utility resolves all {{q.xxx}} system variables before a prompt is executed.
 * It handles both static variables (auto-populated) and variables stored on the prompt.
 */

import { SYSTEM_VARIABLES, SYSTEM_VARIABLE_TYPES } from '@/config/systemVariables';

// ============= Types =============

export interface User {
  email?: string;
  [key: string]: unknown;
}

export interface PromptData {
  row_id?: string;
  prompt_name?: string;
  output_response?: string;
  user_prompt_result?: string;
  [key: string]: unknown;
}

export interface BuildSystemVariablesOptions {
  promptData?: PromptData;
  parentData?: PromptData | null;
  topLevelData?: PromptData | null;
  user?: User | null;
  storedVariables?: Record<string, unknown>;
}

export interface SystemVariableContext {
  user: User | null;
  promptName: string;
  topLevelPromptName: string;
  parentPromptName: string;
}

export interface SystemVariableDefinition {
  type: string;
  getValue?: (context: SystemVariableContext) => string;
}

// ============= Variable Resolution =============

/**
 * Build all system variables for a prompt run
 */
export const buildSystemVariablesForRun = ({
  promptData = {},
  parentData = null,
  topLevelData = null,
  user = null,
  storedVariables = {},
}: BuildSystemVariablesOptions = {}): Record<string, string> => {
  const resolved: Record<string, string> = {};
  
  // Build context for static variable resolution
  const context: SystemVariableContext = {
    user: user,
    promptName: promptData?.prompt_name || '',
    topLevelPromptName: topLevelData?.prompt_name || parentData?.prompt_name || promptData?.prompt_name || '',
    parentPromptName: parentData?.prompt_name || '',
  };
  
  // 1. Resolve all static system variables (auto-populated)
  Object.entries(SYSTEM_VARIABLES as Record<string, SystemVariableDefinition>).forEach(([varName, def]) => {
    if (def.type === SYSTEM_VARIABLE_TYPES.STATIC && def.getValue) {
      try {
        resolved[varName] = def.getValue(context);
      } catch (e) {
        console.warn(`Failed to resolve static variable ${varName}:`, e);
      }
    }
  });
  
  // 2. Add stored variables from the prompt's system_variables field
  if (storedVariables && typeof storedVariables === 'object') {
    Object.entries(storedVariables).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        resolved[key] = String(value);
      }
    });
  }
  
  // 3. Add prompt context variables
  if (promptData) {
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
 */
export const applyTemplateVariables = (
  text: string,
  variables: Record<string, unknown> = {}
): string => {
  if (!text || typeof text !== 'string') return text;
  if (!variables || Object.keys(variables).length === 0) return text;
  
  let result = text;
  
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
 */
export const extractVariableNames = (text: string): string[] => {
  if (!text || typeof text !== 'string') return [];
  
  const pattern = /\{\{([^}]+)\}\}/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  
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
