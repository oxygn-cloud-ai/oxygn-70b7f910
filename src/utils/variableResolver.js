/**
 * Variable Resolver Utility
 * 
 * Handles variable parsing and resolution for the template system.
 * 
 * Variable Types:
 * - User Variables: {{variableName}} - User-defined, editable
 * - System Variables: {{q.fieldName}} - System-managed, read-only
 * - Chained Variables: {{rowId.fieldName}} - References other prompts
 * 
 * System Variable Prefixes (q.):
 * - q.response - Last AI response content
 * - q.model - Model used for last call
 * - q.tokens_input - Input tokens used
 * - q.tokens_output - Output tokens used
 * - q.tokens_total - Total tokens used
 * - q.cost_input - Cost of input tokens (USD)
 * - q.cost_output - Cost of output tokens (USD)
 * - q.cost_total - Total cost (USD)
 * - q.finish_reason - AI finish reason
 * - q.latency_ms - Response latency
 * - q.response_id - AI response ID
 * - q.timestamp - When the call was made
 * - q.parent.fieldName - Parent prompt fields
 * - q.child[index].fieldName - Child prompt fields
 * - q.meta.fieldName - Additional metadata
 */

// Regex patterns for different variable types
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;
const SYSTEM_VARIABLE_PREFIX = 'q.';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Named variable pattern: q.nodename.keypath (access by prompt name, not UUID)
const NAMED_VARIABLE_PATTERN = /^q\.([^.]+)\.(.+)$/;

/**
 * Extract all variables from a text string
 * @param {string} text - Text to extract variables from
 * @returns {Array<{name: string, type: 'user' | 'system' | 'chained', fullMatch: string}>}
 */
export const extractVariables = (text) => {
  if (!text || typeof text !== 'string') return [];
  
  const variables = [];
  const matches = text.matchAll(VARIABLE_PATTERN);
  
  for (const match of matches) {
    const variableName = match[1].trim();
    const fullMatch = match[0];
    
    let type = 'user';
    if (variableName.startsWith(SYSTEM_VARIABLE_PREFIX)) {
      type = 'system';
    } else if (variableName.includes('.') && UUID_PATTERN.test(variableName.split('.')[0])) {
      type = 'chained';
    }
    
    variables.push({
      name: variableName,
      type,
      fullMatch,
    });
  }
  
  return variables;
};

/**
 * Check if a variable name is a system variable (read-only)
 * @param {string} variableName - Variable name to check
 * @returns {boolean}
 */
export const isSystemVariable = (variableName) => {
  return variableName?.startsWith(SYSTEM_VARIABLE_PREFIX);
};

/**
 * Check if a variable name is a chained variable
 * @param {string} variableName - Variable name to check
 * @returns {boolean}
 */
export const isChainedVariable = (variableName) => {
  if (!variableName || variableName.startsWith(SYSTEM_VARIABLE_PREFIX)) return false;
  const parts = variableName.split('.');
  return parts.length >= 2 && UUID_PATTERN.test(parts[0]);
};

/**
 * Parse a chained variable into its components
 * @param {string} variableName - Chained variable name
 * @returns {{promptId: string, fieldName: string} | null}
 */
export const parseChainedVariable = (variableName) => {
  if (!isChainedVariable(variableName)) return null;
  
  const firstDotIndex = variableName.indexOf('.');
  return {
    promptId: variableName.substring(0, firstDotIndex),
    fieldName: variableName.substring(firstDotIndex + 1),
  };
};

/**
 * Parse a system variable into its components
 * @param {string} variableName - System variable name (e.g., "q.parent.input_admin_prompt")
 * @returns {{category: string, path: string[]} | null}
 */
export const parseSystemVariable = (variableName) => {
  if (!isSystemVariable(variableName)) return null;
  
  const withoutPrefix = variableName.substring(SYSTEM_VARIABLE_PREFIX.length);
  const parts = withoutPrefix.split('.');
  
  return {
    category: parts[0], // e.g., 'parent', 'child', 'meta', 'response', etc.
    path: parts.slice(1), // remaining path parts
  };
};

/**
 * Get nested value from object using dot notation path
 * e.g., getNestedValue({ data: { items: [1,2,3] } }, 'data.items') => [1,2,3]
 */
const getNestedValue = (obj, path) => {
  if (!path || !obj) return undefined;
  
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    
    // Handle array index access
    if (Array.isArray(value) && /^\d+$/.test(key)) {
      value = value[parseInt(key, 10)];
    } else {
      value = value[key];
    }
  }
  
  return value;
};

/**
 * Resolve a single variable value
 * @param {string} variableName - Variable name to resolve
 * @param {Object} context - Resolution context containing:
 *   - userVariables: Map of user variable values
 *   - systemVariables: System variables from last_ai_call_metadata
 *   - promptData: Current prompt data
 *   - parentData: Parent prompt data
 *   - childrenData: Array of child prompts
 *   - siblingsData: Array of sibling prompts (for named variable access)
 *   - fetchPromptById: Async function to fetch prompt by ID
 *   - fetchPromptByName: Async function to fetch prompt by name
 * @returns {Promise<string>}
 */
export const resolveVariable = async (variableName, context = {}) => {
  const {
    userVariables = {},
    systemVariables = {},
    promptData = {},
    parentData = null,
    childrenData = [],
    siblingsData = [],
    fetchPromptById = null,
    fetchPromptByName = null,
  } = context;
  
  // System variables (q.*)
  if (isSystemVariable(variableName)) {
    const parsed = parseSystemVariable(variableName);
    if (!parsed) return `{{${variableName}}}`;
    
    const { category, path } = parsed;
    
    // Check for named variable pattern first: q.nodename.keypath
    // This allows accessing extracted_variables from sibling/parent nodes by name
    const namedMatch = variableName.match(NAMED_VARIABLE_PATTERN);
    if (namedMatch) {
      const [, nodeName, keyPath] = namedMatch;
      
      // Skip reserved categories
      const reservedCategories = ['parent', 'child', 'meta', 'response', 'model', 'tokens_input', 
        'tokens_output', 'tokens_total', 'cost_input', 'cost_output', 'cost_total', 
        'finish_reason', 'latency_ms', 'response_id', 'timestamp', 'previous', 'today', 'user'];
      
      if (!reservedCategories.includes(nodeName.toLowerCase())) {
        // Search siblings for matching node name
        const sibling = siblingsData.find(s => 
          s.prompt_name?.toLowerCase() === nodeName.toLowerCase()
        );
        
        if (sibling?.extracted_variables) {
          const value = getNestedValue(sibling.extracted_variables, keyPath);
          if (value !== undefined) {
            return typeof value === 'object' ? JSON.stringify(value) : String(value);
          }
        }
        
        // Check parent
        if (parentData?.prompt_name?.toLowerCase() === nodeName.toLowerCase()) {
          if (parentData.extracted_variables) {
            const value = getNestedValue(parentData.extracted_variables, keyPath);
            if (value !== undefined) {
              return typeof value === 'object' ? JSON.stringify(value) : String(value);
            }
          }
        }
        
        // Try to fetch by name if function provided
        if (fetchPromptByName) {
          try {
            const prompt = await fetchPromptByName(nodeName);
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
        
        // Return unresolved if not found
        return `{{${variableName}}}`;
      }
    }
    
    // Direct system variables (q.response, q.model, etc.)
    if (path.length === 0) {
      return systemVariables[category] ?? `{{${variableName}}}`;
    }
    
    // Parent references (q.parent.fieldName)
    if (category === 'parent' && parentData) {
      const fieldName = path.join('.');
      // Check extracted_variables first for action node data
      if (parentData.extracted_variables) {
        const value = getNestedValue(parentData.extracted_variables, fieldName);
        if (value !== undefined) {
          return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      }
      return parentData[fieldName] ?? `{{${variableName}}}`;
    }
    
    // Child references (q.child[0].fieldName)
    if (category.startsWith('child')) {
      const indexMatch = category.match(/child\[(\d+)\]/);
      if (indexMatch) {
        const index = parseInt(indexMatch[1], 10);
        if (childrenData[index]) {
          const fieldName = path.join('.');
          // Check extracted_variables first
          if (childrenData[index].extracted_variables) {
            const value = getNestedValue(childrenData[index].extracted_variables, fieldName);
            if (value !== undefined) {
              return typeof value === 'object' ? JSON.stringify(value) : String(value);
            }
          }
          return childrenData[index][fieldName] ?? `{{${variableName}}}`;
        }
      }
    }
    
    // Meta references (q.meta.*)
    if (category === 'meta') {
      const metaKey = path.join('.');
      return systemVariables.meta?.[metaKey] ?? `{{${variableName}}}`;
    }
    
    return `{{${variableName}}}`;
  }
  
  // Chained variables (uuid.fieldName)
  if (isChainedVariable(variableName)) {
    const parsed = parseChainedVariable(variableName);
    if (!parsed) return `{{${variableName}}}`;
    
    // Check if it's the current prompt
    if (parsed.promptId === promptData.row_id) {
      return promptData[parsed.fieldName] ?? `{{${variableName}}}`;
    }
    
    // Check if it's the parent
    if (parentData && parsed.promptId === parentData.row_id) {
      return parentData[parsed.fieldName] ?? `{{${variableName}}}`;
    }
    
    // Check children
    const childMatch = childrenData.find(c => c.row_id === parsed.promptId);
    if (childMatch) {
      return childMatch[parsed.fieldName] ?? `{{${variableName}}}`;
    }
    
    // Fetch from database if function provided
    if (fetchPromptById) {
      try {
        const prompt = await fetchPromptById(parsed.promptId);
        if (prompt) {
          return prompt[parsed.fieldName] ?? `{{${variableName}}}`;
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
 * @param {string} text - Text containing variables
 * @param {Object} context - Resolution context (see resolveVariable)
 * @returns {Promise<string>}
 */
export const resolveAllVariables = async (text, context = {}) => {
  if (!text || typeof text !== 'string') return text;
  
  const variables = extractVariables(text);
  if (variables.length === 0) return text;
  
  let result = text;
  
  // Process all variables
  for (const variable of variables) {
    const resolvedValue = await resolveVariable(variable.name, context);
    // Only replace if the value was actually resolved (not still a placeholder)
    if (!resolvedValue.startsWith('{{')) {
      result = result.replace(variable.fullMatch, resolvedValue);
    }
  }
  
  return result;
};

/**
 * Build system variables from AI call response
 * @param {Object} response - OpenAI API response
 * @param {Object} pricing - Pricing info {cost_per_1k_input, cost_per_1k_output}
 * @param {number} latencyMs - Request latency in ms
 * @returns {Object} System variables object
 */
export const buildSystemVariables = (response, pricing = {}, latencyMs = 0) => {
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

/**
 * Get all user-defined variable names from text (excludes system and chained)
 * @param {string} text - Text to scan
 * @returns {string[]} Array of user variable names
 */
export const getUserVariableNames = (text) => {
  return extractVariables(text)
    .filter(v => v.type === 'user')
    .map(v => v.name);
};

/**
 * Validate a variable name
 * @param {string} name - Variable name to validate
 * @returns {{valid: boolean, error?: string}}
 */
export const validateVariableName = (name) => {
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
