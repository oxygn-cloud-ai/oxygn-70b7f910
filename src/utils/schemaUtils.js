/**
 * Schema Utility Functions
 * 
 * Utility functions for working with JSON schemas.
 */

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
