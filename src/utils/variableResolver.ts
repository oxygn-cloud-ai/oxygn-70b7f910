/**
 * Variable Resolver Utility
 * 
 * Handles variable parsing and resolution for the template system.
 * 
 * Variable Types:
 * - User Variables: {{variableName}} - User-defined, editable
 * - System Variables: {{q.fieldName}} - System-managed, read-only
 * - Chained Variables: {{rowId.fieldName}} - References other prompts
 */

// ============= Types =============

export interface ExtractedVariable {
  name: string;
  type: 'user' | 'system' | 'chained';
  fullMatch: string;
}

export interface ParsedChainedVariable {
  promptId: string;
  fieldName: string;
}

export interface ParsedSystemVariable {
  category: string;
  path: string[];
}

export interface VariableValidationResult {
  valid: boolean;
  error?: string;
}

export interface SystemVariablesResult {
  response: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  cost_input: string;
  cost_output: string;
  cost_total: string;
  finish_reason: string;
  latency_ms: number;
  response_id: string;
  timestamp: string;
  meta: {
    system_fingerprint: string;
    object: string;
  };
}

export interface PromptData {
  row_id?: string;
  prompt_name?: string;
  extracted_variables?: Record<string, unknown>;
  output_response?: string;
  user_prompt_result?: string;
  [key: string]: unknown;
}

export interface ResolutionContext {
  userVariables?: Record<string, string>;
  systemVariables?: Record<string, unknown>;
  promptData?: PromptData;
  parentData?: PromptData | null;
  childrenData?: PromptData[];
  siblingsData?: PromptData[];
  fetchPromptById?: ((id: string, context: { owner_id?: string | null; root_prompt_row_id?: string | null }) => Promise<PromptData | null>) | null;
  fetchPromptByName?: ((name: string, context: { owner_id?: string | null; root_prompt_row_id?: string | null }) => Promise<PromptData | null>) | null;
  owner_id?: string | null;
  root_prompt_row_id?: string | null;
}

export interface PricingInfo {
  cost_per_1k_input_tokens?: number;
  cost_per_1k_output_tokens?: number;
}

// ============= Constants =============

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;
const SYSTEM_VARIABLE_PREFIX = 'q.';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAMED_VARIABLE_PATTERN = /^q\.([^.]+)\.(.+)$/;
const QREF_PATTERN = /^q\.ref\[([a-f0-9-]{36})\]\.([a-z_]+)$/i;
const QREF_ALLOWED_FIELDS = ['output_response', 'user_prompt_result', 'input_admin_prompt', 'input_user_prompt', 'prompt_name'];

// ============= Helper Functions =============

/**
 * Get nested value from object using dot notation path
 */
const getNestedValue = (obj: unknown, path: string): unknown => {
  if (!path || !obj || typeof obj !== 'object') return undefined;
  
  const keys = path.split('.');
  let value: unknown = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    
    if (Array.isArray(value) && /^\d+$/.test(key)) {
      value = value[parseInt(key, 10)];
    } else if (typeof value === 'object') {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return value;
};

// ============= Variable Extraction =============

/**
 * Extract all variables from a text string
 */
export const extractVariables = (text: string): ExtractedVariable[] => {
  if (!text || typeof text !== 'string') return [];
  
  const variables: ExtractedVariable[] = [];
  const matches = text.matchAll(VARIABLE_PATTERN);
  
  for (const match of matches) {
    const variableName = match[1].trim();
    const fullMatch = match[0];
    
    let type: 'user' | 'system' | 'chained' = 'user';
    if (variableName.startsWith(SYSTEM_VARIABLE_PREFIX)) {
      type = 'system';
    } else if (variableName.includes('.') && UUID_PATTERN.test(variableName.split('.')[0])) {
      type = 'chained';
    }
    
    variables.push({ name: variableName, type, fullMatch });
  }
  
  return variables;
};

/**
 * Check if a variable name is a system variable (read-only)
 */
export const isSystemVariable = (variableName: string): boolean => {
  return variableName?.startsWith(SYSTEM_VARIABLE_PREFIX);
};

/**
 * Check if a variable name is a chained variable
 */
export const isChainedVariable = (variableName: string): boolean => {
  if (!variableName || variableName.startsWith(SYSTEM_VARIABLE_PREFIX)) return false;
  const parts = variableName.split('.');
  return parts.length >= 2 && UUID_PATTERN.test(parts[0]);
};

/**
 * Parse a chained variable into its components
 */
export const parseChainedVariable = (variableName: string): ParsedChainedVariable | null => {
  if (!isChainedVariable(variableName)) return null;
  
  const firstDotIndex = variableName.indexOf('.');
  return {
    promptId: variableName.substring(0, firstDotIndex),
    fieldName: variableName.substring(firstDotIndex + 1),
  };
};

/**
 * Parse a system variable into its components
 */
export const parseSystemVariable = (variableName: string): ParsedSystemVariable | null => {
  if (!isSystemVariable(variableName)) return null;
  
  const withoutPrefix = variableName.substring(SYSTEM_VARIABLE_PREFIX.length);
  const parts = withoutPrefix.split('.');
  
  return {
    category: parts[0],
    path: parts.slice(1),
  };
};

// ============= Variable Resolution =============

/**
 * Resolve a single variable value
 */
export const resolveVariable = async (
  variableName: string,
  context: ResolutionContext = {}
): Promise<string> => {
  const {
    userVariables = {},
    systemVariables = {},
    promptData = {},
    parentData = null,
    childrenData = [],
    siblingsData = [],
    fetchPromptById = null,
    fetchPromptByName = null,
    owner_id = null,
    root_prompt_row_id = null,
  } = context;
  
  // System variables (q.*)
  if (isSystemVariable(variableName)) {
    const parsed = parseSystemVariable(variableName);
    if (!parsed) return `{{${variableName}}}`;
    
    const { category, path } = parsed;
    
    // Check for q.ref[UUID].field pattern FIRST
    const qrefMatch = variableName.match(QREF_PATTERN);
    if (qrefMatch) {
      const [, promptId, field] = qrefMatch;
      
      if (!QREF_ALLOWED_FIELDS.includes(field)) {
        console.warn(`q.ref: Field "${field}" not in allowed list`);
        return `{{${variableName}}}`;
      }
      
      // Check parent
      if (parentData && parentData.row_id === promptId) {
        return (parentData[field] as string) ?? `{{${variableName}}}`;
      }
      
      // Check children
      const childMatch = childrenData.find(c => c.row_id === promptId);
      if (childMatch) {
        return (childMatch[field] as string) ?? `{{${variableName}}}`;
      }
      
      // Check siblings
      const siblingMatch = siblingsData.find(s => s.row_id === promptId);
      if (siblingMatch) {
        return (siblingMatch[field] as string) ?? `{{${variableName}}}`;
      }
      
      // Fetch from database
      if (fetchPromptById) {
        try {
          const prompt = await fetchPromptById(promptId, { owner_id, root_prompt_row_id });
          if (prompt) {
            return (prompt[field] as string) ?? `{{${variableName}}}`;
          }
          return '[Deleted Reference]';
        } catch (e) {
          console.error('Error resolving q.ref:', e);
        }
      }
      
      return `{{${variableName}}}`;
    }
    
    // Check for named variable pattern
    const namedMatch = variableName.match(NAMED_VARIABLE_PATTERN);
    if (namedMatch) {
      const [, nodeName, keyPath] = namedMatch;
      
      const reservedCategories = ['parent', 'child', 'meta', 'response', 'model', 'tokens_input', 
        'tokens_output', 'tokens_total', 'cost_input', 'cost_output', 'cost_total', 
        'finish_reason', 'latency_ms', 'response_id', 'timestamp', 'previous', 'today', 'user'];
      
      if (!reservedCategories.includes(nodeName.toLowerCase())) {
        const sibling = siblingsData.find(s => 
          s.prompt_name?.toLowerCase() === nodeName.toLowerCase()
        );
        
        if (sibling?.extracted_variables) {
          const value = getNestedValue(sibling.extracted_variables, keyPath);
          if (value !== undefined) {
            return typeof value === 'object' ? JSON.stringify(value) : String(value);
          }
        }
        
        if (parentData?.prompt_name?.toLowerCase() === nodeName.toLowerCase()) {
          if (parentData.extracted_variables) {
            const value = getNestedValue(parentData.extracted_variables, keyPath);
            if (value !== undefined) {
              return typeof value === 'object' ? JSON.stringify(value) : String(value);
            }
          }
        }
        
        if (fetchPromptByName) {
          try {
            const prompt = await fetchPromptByName(nodeName, { owner_id, root_prompt_row_id });
            if (prompt?.extracted_variables) {
              const value = getNestedValue(prompt.extracted_variables, keyPath);
              if (value !== undefined) {
                return typeof value === 'object' ? JSON.stringify(value) : String(value);
              }
            }
          } catch (e) {
            console.error('Error fetching prompt by name for variable:', e);
          }
        }
        
        return `{{${variableName}}}`;
      }
    }
    
    // Direct system variables
    if (path.length === 0) {
      const sysVal = systemVariables[category];
      return sysVal !== undefined ? String(sysVal) : `{{${variableName}}}`;
    }
    
    // Parent references
    if (category === 'parent' && parentData) {
      const fieldName = path.join('.');
      if (parentData.extracted_variables) {
        const value = getNestedValue(parentData.extracted_variables, fieldName);
        if (value !== undefined) {
          return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      }
      const directVal = parentData[fieldName];
      return directVal !== undefined ? String(directVal) : `{{${variableName}}}`;
    }
    
    // Child references
    if (category.startsWith('child')) {
      const indexMatch = category.match(/child\[(\d+)\]/);
      if (indexMatch) {
        const index = parseInt(indexMatch[1], 10);
        if (childrenData[index]) {
          const fieldName = path.join('.');
          if (childrenData[index].extracted_variables) {
            const value = getNestedValue(childrenData[index].extracted_variables, fieldName);
            if (value !== undefined) {
              return typeof value === 'object' ? JSON.stringify(value) : String(value);
            }
          }
          const directVal = childrenData[index][fieldName];
          return directVal !== undefined ? String(directVal) : `{{${variableName}}}`;
        }
      }
    }
    
    // Meta references
    if (category === 'meta') {
      const metaKey = path.join('.');
      const metaVal = (systemVariables.meta as Record<string, unknown>)?.[metaKey];
      return metaVal !== undefined ? String(metaVal) : `{{${variableName}}}`;
    }
    
    return `{{${variableName}}}`;
  }
  
  // Chained variables
  if (isChainedVariable(variableName)) {
    const parsed = parseChainedVariable(variableName);
    if (!parsed) return `{{${variableName}}}`;
    
    if (parsed.promptId === promptData.row_id) {
      const val = promptData[parsed.fieldName];
      return val !== undefined ? String(val) : `{{${variableName}}}`;
    }
    
    if (parentData && parsed.promptId === parentData.row_id) {
      const val = parentData[parsed.fieldName];
      return val !== undefined ? String(val) : `{{${variableName}}}`;
    }
    
    const childMatch = childrenData.find(c => c.row_id === parsed.promptId);
    if (childMatch) {
      const val = childMatch[parsed.fieldName];
      return val !== undefined ? String(val) : `{{${variableName}}}`;
    }
    
    if (fetchPromptById) {
      try {
        const prompt = await fetchPromptById(parsed.promptId, { owner_id, root_prompt_row_id });
        if (prompt) {
          const val = prompt[parsed.fieldName];
          return val !== undefined ? String(val) : `{{${variableName}}}`;
        }
      } catch (e) {
        console.error('Error fetching prompt for chained variable:', e);
      }
    }
    
    return `{{${variableName}}}`;
  }
  
  // User variables
  return userVariables[variableName] ?? `{{${variableName}}}`;
};

/**
 * Resolve all variables in a text string
 */
export const resolveAllVariables = async (
  text: string,
  context: ResolutionContext = {}
): Promise<string> => {
  if (!text || typeof text !== 'string') return text;
  
  const variables = extractVariables(text);
  if (variables.length === 0) return text;
  
  let result = text;
  
  for (const variable of variables) {
    const resolvedValue = await resolveVariable(variable.name, context);
    if (!resolvedValue.startsWith('{{')) {
      result = result.replace(variable.fullMatch, resolvedValue);
    }
  }
  
  return result;
};

// ============= System Variables Building =============

interface OpenAIResponse {
  id?: string;
  model?: string;
  system_fingerprint?: string;
  object?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
}

/**
 * Build system variables from AI call response
 */
export const buildSystemVariables = (
  response: OpenAIResponse,
  pricing: PricingInfo = {},
  latencyMs: number = 0
): SystemVariablesResult => {
  const usage = response?.usage || {};
  const choice = response?.choices?.[0] || {};
  
  const tokensInput = usage.prompt_tokens || 0;
  const tokensOutput = usage.completion_tokens || 0;
  const tokensTotal = usage.total_tokens || tokensInput + tokensOutput;
  
  const costInput = (tokensInput / 1000) * (pricing.cost_per_1k_input_tokens || 0);
  const costOutput = (tokensOutput / 1000) * (pricing.cost_per_1k_output_tokens || 0);
  const costTotal = costInput + costOutput;
  
  return {
    response: choice.message?.content || '',
    model: response?.model || '',
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    tokens_total: tokensTotal,
    cost_input: costInput.toFixed(8),
    cost_output: costOutput.toFixed(8),
    cost_total: costTotal.toFixed(8),
    finish_reason: choice.finish_reason || '',
    latency_ms: latencyMs,
    response_id: response?.id || '',
    timestamp: new Date().toISOString(),
    meta: {
      system_fingerprint: response?.system_fingerprint || '',
      object: response?.object || '',
    },
  };
};

// ============= Utility Functions =============

/**
 * Get all user-defined variable names from text
 */
export const getUserVariableNames = (text: string): string[] => {
  return extractVariables(text)
    .filter(v => v.type === 'user')
    .map(v => v.name);
};

/**
 * Validate a variable name
 */
export const validateVariableName = (name: string): VariableValidationResult => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Variable name is required' };
  }
  
  if (name.startsWith(SYSTEM_VARIABLE_PREFIX)) {
    return { valid: false, error: 'Cannot use reserved prefix "q."' };
  }
  
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    return { valid: false, error: 'Variable name must start with a letter and contain only letters, numbers, underscores, and hyphens' };
  }
  
  if (name.length > 50) {
    return { valid: false, error: 'Variable name must be 50 characters or less' };
  }
  
  return { valid: true };
};

export default {
  extractVariables,
  isSystemVariable,
  isChainedVariable,
  parseChainedVariable,
  parseSystemVariable,
  resolveVariable,
  resolveAllVariables,
  buildSystemVariables,
  getUserVariableNames,
  validateVariableName,
};
