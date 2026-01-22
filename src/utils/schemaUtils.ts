/**
 * Schema Utility Functions
 * 
 * Utility functions for working with JSON schemas.
 */

// ============= Types =============

export interface JsonSchemaObject {
  type?: string;
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  items?: JsonSchemaObject;
  additionalProperties?: boolean;
  description?: string;
  [key: string]: unknown;
}

export interface ArrayPathInfo {
  path: string;
  itemType: string;
  itemProps: string[];
  description: string;
}

export interface SchemaKeyInfo {
  key: string;
  type: string;
  description: string;
  isArray: boolean;
  hasItems: boolean;
}

export interface SchemaActionValidation {
  isValid: boolean;
  warnings: string[];
  suggestions: string[];
  arrayPaths: string[];
}

export interface TemplateObject {
  node_config?: unknown;
  action_config?: unknown;
}

// ============= Strict Compliance =============

/**
 * Ensure a JSON schema is compliant with OpenAI's strict mode requirements.
 * - All objects must have additionalProperties: false
 * - All properties must be listed in the required array
 */
export const ensureStrictCompliance = <T extends JsonSchemaObject>(schema: T): T => {
  if (!schema || typeof schema !== 'object') return schema;
  
  const fixed = { ...schema } as T;
  
  if (fixed.type === 'object' && fixed.properties) {
    fixed.additionalProperties = false;
    fixed.required = Object.keys(fixed.properties);
    
    fixed.properties = Object.fromEntries(
      Object.entries(fixed.properties).map(([key, value]) => [
        key,
        ensureStrictCompliance(value as JsonSchemaObject)
      ])
    ) as Record<string, JsonSchemaObject>;
  }
  
  if (fixed.type === 'array' && fixed.items) {
    fixed.items = ensureStrictCompliance(fixed.items);
  }
  
  return fixed;
};

/**
 * Check if a schema was modified by ensureStrictCompliance
 */
export const schemaWasModified = (original: unknown, fixed: unknown): boolean => {
  return JSON.stringify(original) !== JSON.stringify(fixed);
};

// ============= Array Path Discovery =============

/**
 * Find all array paths in a schema (for create_children_json action)
 * Recursively traverses into nested objects AND array items to find all arrays
 */
export const findArrayPaths = (schema: JsonSchemaObject, prefix: string = ''): ArrayPathInfo[] => {
  if (!schema || typeof schema !== 'object') return [];
  
  const paths: ArrayPathInfo[] = [];
  
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
      paths.push(...findArrayPaths(value as JsonSchemaObject, path));
    }
  }
  
  return paths;
};

/**
 * Get a simple list of array path strings from a schema
 */
export const getArrayPathStrings = (schema: JsonSchemaObject): string[] => {
  const arrayPaths = findArrayPaths(schema);
  return arrayPaths.map(p => p.path.replace(/\[\*\]/g, ''));
};

// ============= Action Validation =============

interface ActionConfig {
  json_path?: string;
  [key: string]: unknown;
}

/**
 * Validate schema structure against action type requirements
 */
export const validateSchemaForAction = (
  schema: JsonSchemaObject,
  actionType: string,
  config: ActionConfig = {}
): SchemaActionValidation => {
  const result: SchemaActionValidation = {
    isValid: true,
    warnings: [],
    suggestions: [],
    arrayPaths: [],
  };
  
  if (!schema || !actionType) return result;
  
  const arrayPathObjects = findArrayPaths(schema);
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
      if (arrayPathStrings.length > 0 && schema.properties && Object.keys(schema.properties).length === 1) {
        result.suggestions.push('Schema has an array. Consider "Create Children (JSON)" for better control.');
      }
      break;
      
    case 'create_children_text':
      if (schema.type === 'object' || schema.type === 'array') {
        result.warnings.push('"Create Children (Text)" expects plain text, but schema defines structured output.');
        result.suggestions.push('Consider using "Create Children (JSON)" or "Create Children (Sections)" instead.');
      }
      break;
  }
  
  return result;
};

// ============= Schema Key Extraction =============

/**
 * Extract top-level keys from a schema for visual key picker
 */
export const extractSchemaKeys = (schema: JsonSchemaObject): SchemaKeyInfo[] => {
  if (!schema?.properties) return [];
  
  return Object.entries(schema.properties).map(([key, value]) => ({
    key,
    type: (value as JsonSchemaObject).type || 'any',
    description: (value as JsonSchemaObject).description || '',
    isArray: (value as JsonSchemaObject).type === 'array',
    hasItems: !!(value as JsonSchemaObject).items,
  }));
};

/**
 * Format a schema for use in AI prompts
 */
export const formatSchemaForPrompt = (schema: JsonSchemaObject): string => {
  if (!schema || typeof schema !== 'object') return '';

  const lines: string[] = ['Expected JSON structure:'];
  
  const formatProperties = (props: Record<string, JsonSchemaObject> | undefined, required: string[] = [], indent: string = '  '): void => {
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
 */
export const isFullTemplate = (template: TemplateObject | null | undefined): boolean => {
  return !!(template?.node_config && template?.action_config);
};

export default {
  ensureStrictCompliance,
  schemaWasModified,
  findArrayPaths,
  getArrayPathStrings,
  validateSchemaForAction,
  extractSchemaKeys,
  formatSchemaForPrompt,
  isFullTemplate,
};
