// @ts-nocheck
/**
 * Schema Utility Functions
 * 
 * Utility functions for working with JSON schemas.
 */

/**
 * Ensure a JSON schema is compliant with OpenAI's strict mode requirements.
 * - All objects must have additionalProperties: false
 * - All properties must be listed in the required array
 * @param {Object} schema - JSON schema object
 * @returns {Object} Fixed schema with strict mode compliance
 */
export const ensureStrictCompliance = (schema) => {
  if (!schema || typeof schema !== 'object') return schema;
  
  const fixed = { ...schema };
  
  if (fixed.type === 'object' && fixed.properties) {
    // Add additionalProperties: false for strict mode
    fixed.additionalProperties = false;
    
    // Ensure all properties are required
    fixed.required = Object.keys(fixed.properties);
    
    // Recursively fix nested objects/arrays
    fixed.properties = Object.fromEntries(
      Object.entries(fixed.properties).map(([key, value]) => [
        key,
        ensureStrictCompliance(value)
      ])
    );
  }
  
  if (fixed.type === 'array' && fixed.items) {
    fixed.items = ensureStrictCompliance(fixed.items);
  }
  
  return fixed;
};

/**
 * Check if a schema was modified by ensureStrictCompliance
 * @param {Object} original - Original schema
 * @param {Object} fixed - Fixed schema
 * @returns {boolean} True if changes were made
 */
export const schemaWasModified = (original, fixed) => {
  return JSON.stringify(original) !== JSON.stringify(fixed);
};

/**
 * Find all array paths in a schema (for create_children_json action)
 * Recursively traverses into nested objects AND array items to find all arrays
 * @param {Object} schema - JSON schema object
 * @param {string} prefix - Current path prefix
 * @returns {Array} Array of objects with path, itemType, and description
 */
export const findArrayPaths = (schema, prefix = '') => {
  if (!schema || typeof schema !== 'object') return [];
  
  const paths = [];
  
  // If this node is an array, add it
  if (schema.type === 'array') {
    const itemType = schema.items?.type || 'any';
    const itemProps = schema.items?.properties ? Object.keys(schema.items.properties) : [];
    paths.push({
      path: prefix || 'root',
      itemType,
      itemProps,
      description: schema.description || '',
    });
    
    // Also traverse INTO array items to find nested arrays
    if (schema.items) {
      const nestedPaths = findArrayPaths(schema.items, prefix ? `${prefix}[*]` : '[*]');
      paths.push(...nestedPaths);
    }
  }
  
  // Traverse object properties
  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push(...findArrayPaths(value, path));
    }
  }
  
  return paths;
};

/**
 * Get a simple list of array path strings from a schema
 * @param {Object} schema - JSON schema object
 * @returns {Array} Array of path strings (dot notation)
 */
export const getArrayPathStrings = (schema) => {
  const arrayPaths = findArrayPaths(schema);
  return arrayPaths.map(p => p.path.replace(/\[\*\]/g, ''));
};

/**
 * Validate schema structure against action type requirements
 * @param {Object} schema - JSON schema object
 * @param {string} actionType - The action type (e.g., 'create_children_json')
 * @param {Object} config - Current action config (for json_path)
 * @returns {Object} { isValid: boolean, warnings: string[], suggestions: string[] }
 */
/**
 * Validate schema structure against action type requirements
 * @param {Object} schema - JSON schema object
 * @param {string} actionType - The action type (e.g., 'create_children_json')
 * @param {Object} config - Current action config (for json_path)
 * @returns {Object} { isValid: boolean, warnings: string[], suggestions: string[], arrayPaths: string[] }
 */
export const validateSchemaForAction = (schema, actionType, config = {}) => {
  const result = {
    isValid: true,
    warnings: [],
    suggestions: [],
    arrayPaths: [], // Include for debugging
  };
  
  if (!schema || !actionType) return result;
  
  const arrayPathObjects = findArrayPaths(schema);
  // Extract just the path strings for comparison (fix: was comparing objects to strings)
  const arrayPathStrings = arrayPathObjects.map(p => p.path.replace(/\[\*\]/g, ''));
  result.arrayPaths = arrayPathStrings;
  
  switch (actionType) {
    case 'create_children_json':
      if (arrayPathStrings.length === 0) {
        result.isValid = false;
        result.warnings.push('Schema has no array fields. "Create Children (JSON)" requires an array in the response.');
        result.suggestions.push('Consider using "Create Children (Sections)" for flat key-value structures.');
        result.suggestions.push('Or add an array field to your schema (e.g., "items": { "type": "array", ... })');
      } else if (config.json_path && !arrayPathStrings.includes(config.json_path)) {
        result.warnings.push(`JSON path "${config.json_path}" is not an array in the schema.`);
        result.suggestions.push(`Available arrays: ${arrayPathStrings.join(', ')}`);
      } else if (!config.json_path && arrayPathStrings.length > 0) {
        result.suggestions.push(`Set JSON Path to one of: ${arrayPathStrings.join(', ')}`);
      }
      break;
      
    case 'create_children_sections':
      // Sections work with flat key-value pairs - no array required
      if (arrayPathStrings.length > 0 && schema.properties && Object.keys(schema.properties).length === 1) {
        result.suggestions.push('Schema has an array. Consider "Create Children (JSON)" for better control.');
      }
      break;
      
    case 'create_children_text':
      // Text action expects plain text, not structured JSON
      if (schema.type === 'object' || schema.type === 'array') {
        result.warnings.push('"Create Children (Text)" expects plain text, but schema defines structured output.');
        result.suggestions.push('Consider using "Create Children (JSON)" or "Create Children (Sections)" instead.');
      }
      break;
  }
  
  return result;
};

/**
 * Extract top-level keys from a schema for visual key picker
 * @param {Object} schema - JSON schema object
 * @returns {Array} Array of key objects with type, description, etc.
 */
export const extractSchemaKeys = (schema) => {
  if (!schema?.properties) return [];
  
  return Object.entries(schema.properties).map(([key, value]) => ({
    key,
    type: value.type || 'any',
    description: value.description || '',
    isArray: value.type === 'array',
    hasItems: !!value.items,
  }));
};

/**
 * Format a schema for use in AI prompts
 * @param {Object} schema - JSON schema object
 * @returns {string} Human-readable schema description
 */
export const formatSchemaForPrompt = (schema) => {
  if (!schema || typeof schema !== 'object') return '';

  const lines = ['Expected JSON structure:'];
  
  const formatProperties = (props, required = [], indent = '  ') => {
    if (!props) return;
    
    Object.entries(props).forEach(([key, value]) => {
      const type = value.type || 'any';
      const desc = value.description ? ` - ${value.description}` : '';
      const isRequired = required?.includes(key) ? ' (required)' : '';
      
      if (type === 'array' && value.items?.type === 'object') {
        lines.push(`${indent}${key}: Array of objects${isRequired}${desc}`);
        if (value.items.properties) {
          formatProperties(value.items.properties, value.items.required, indent + '    ');
        }
      } else if (type === 'object' && value.properties) {
        lines.push(`${indent}${key}: Object${isRequired}${desc}`);
        formatProperties(value.properties, value.required, indent + '  ');
      } else {
        lines.push(`${indent}${key}: ${type}${isRequired}${desc}`);
      }
    });
  };

  formatProperties(schema.properties, schema.required);
  return lines.join('\n');
};

/**
 * Check if a template has full configuration (node + action config)
 * @param {Object} template - Template object from database
 * @returns {boolean} True if template has full configuration
 */
export const isFullTemplate = (template) => {
  return !!(template?.node_config && template?.action_config);
};
