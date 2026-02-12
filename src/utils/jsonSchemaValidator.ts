// @ts-nocheck
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import addErrors from 'ajv-errors';

/**
 * JSON Schema Validator utility using Ajv
 * Provides validation for both schema structure and data against schemas
 */

// Create Ajv instance with OpenAI-compatible settings
const createAjv = () => {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false, // Allow OpenAI-style schemas with additionalProperties: false
    validateFormats: true,
  });
  
  addFormats(ajv);
  addErrors(ajv);
  
  return ajv;
};

// Singleton instance
let ajvInstance = null;

const getAjv = () => {
  if (!ajvInstance) {
    ajvInstance = createAjv();
  }
  return ajvInstance;
};

/**
 * JSON Schema Draft-07 meta-schema (simplified for common validation)
 * Used to validate that a schema is structurally correct
 */
const JSON_SCHEMA_META = {
  type: 'object',
  properties: {
    type: { 
      oneOf: [
        { type: 'string', enum: ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'] },
        { type: 'array', items: { type: 'string', enum: ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'] } }
      ]
    },
    properties: { type: 'object' },
    required: { type: 'array', items: { type: 'string' } },
    items: { type: 'object' },
    additionalProperties: { type: 'boolean' },
    description: { type: 'string' },
    enum: { type: 'array' },
    minimum: { type: 'number' },
    maximum: { type: 'number' },
    minLength: { type: 'integer' },
    maxLength: { type: 'integer' },
    pattern: { type: 'string' },
    format: { type: 'string' },
    default: {},
  },
  additionalProperties: true, // Allow unknown keywords
};

/**
 * Extract the actual schema from various wrapper formats
 * Handles OpenAI format, wrapped format, and direct schemas
 */
const extractSchema = (input) => {
  if (!input) return null;
  
  // Handle OpenAI format: { json_schema: { name, schema: {...} } }
  if (input.json_schema?.schema) {
    return input.json_schema.schema;
  }
  // Handle wrapped format: { schema: {...} }
  if (input.schema?.properties) {
    return input.schema;
  }
  // Handle direct schema: { type, properties: {...} }
  if (input.properties || input.type) {
    return input;
  }
  // Handle deeply nested: { json_schema: { json_schema: { schema: {...} } } }
  if (input.json_schema?.json_schema?.schema) {
    return input.json_schema.json_schema.schema;
  }
  
  return input;
};

/**
 * Validate that an object is a valid JSON Schema structure
 * @param {object} schema - The JSON Schema to validate
 * @returns {{ isValid: boolean, errors: Array<{ path: string, message: string }>, warnings: Array<string> }}
 */
export const validateJsonSchema = (schema) => {
  const errors = [];
  const warnings = [];
  
  if (!schema) {
    return { isValid: false, errors: [{ path: '', message: 'Schema is empty or undefined' }], warnings };
  }
  
  const extractedSchema = extractSchema(schema);
  if (!extractedSchema) {
    return { isValid: false, errors: [{ path: '', message: 'Could not extract schema from input' }], warnings };
  }
  
  // Basic structure validation
  if (typeof extractedSchema !== 'object') {
    return { isValid: false, errors: [{ path: '', message: 'Schema must be an object' }], warnings };
  }
  
  // Check for type
  if (!extractedSchema.type && !extractedSchema.properties && !extractedSchema.oneOf && !extractedSchema.anyOf) {
    warnings.push('Schema should have a "type" property or use composition keywords (oneOf, anyOf)');
  }
  
  // Validate properties structure if present
  if (extractedSchema.properties) {
    if (typeof extractedSchema.properties !== 'object') {
      errors.push({ path: 'properties', message: '"properties" must be an object' });
    } else {
      // Validate each property
      for (const [propName, propDef] of Object.entries(extractedSchema.properties)) {
        if (typeof propDef !== 'object') {
          errors.push({ path: `properties.${propName}`, message: `Property "${propName}" must be an object` });
          continue;
        }
        
        // Check for valid type
        if (propDef.type && typeof propDef.type === 'string') {
          const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
          if (!validTypes.includes(propDef.type)) {
            errors.push({ path: `properties.${propName}.type`, message: `Invalid type "${propDef.type}" for property "${propName}"` });
          }
        }
        
        // Recursive validation for nested objects
        if (propDef.type === 'object' && propDef.properties) {
          const nestedResult = validateJsonSchema(propDef);
          nestedResult.errors.forEach(err => {
            errors.push({ path: `properties.${propName}.${err.path}`, message: err.message });
          });
          nestedResult.warnings.forEach(w => warnings.push(`properties.${propName}: ${w}`));
        }
        
        // Validate array items
        if (propDef.type === 'array') {
          if (!propDef.items) {
            warnings.push(`Array property "${propName}" should have an "items" definition`);
          } else if (propDef.items.type === 'object' && propDef.items.properties) {
            const nestedResult = validateJsonSchema(propDef.items);
            nestedResult.errors.forEach(err => {
              errors.push({ path: `properties.${propName}.items.${err.path}`, message: err.message });
            });
          }
        }
      }
    }
  }
  
  // Validate required array
  if (extractedSchema.required) {
    if (!Array.isArray(extractedSchema.required)) {
      errors.push({ path: 'required', message: '"required" must be an array' });
    } else {
      // Check that required properties exist
      if (extractedSchema.properties) {
        for (const reqProp of extractedSchema.required) {
          if (!extractedSchema.properties[reqProp]) {
            warnings.push(`Required property "${reqProp}" is not defined in properties`);
          }
        }
      }
    }
  }
  
  // OpenAI strict mode recommendations
  if (extractedSchema.additionalProperties !== false) {
    warnings.push('For OpenAI strict mode, "additionalProperties" should be set to false');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate data against a JSON Schema
 * @param {any} data - The data to validate
 * @param {object} schema - The JSON Schema to validate against
 * @returns {{ isValid: boolean, errors: Array<{ path: string, message: string, keyword: string }> }}
 */
export const validateDataAgainstSchema = (data, schema) => {
  const errors = [];
  
  if (!schema) {
    return { isValid: false, errors: [{ path: '', message: 'No schema provided', keyword: 'schema' }] };
  }
  
  const extractedSchema = extractSchema(schema);
  if (!extractedSchema) {
    return { isValid: false, errors: [{ path: '', message: 'Could not extract schema', keyword: 'schema' }] };
  }
  
  try {
    const ajv = getAjv();
    
    // Clear any cached schemas to avoid conflicts
    ajv.removeSchema('temp-validation-schema');
    
    const validate = ajv.compile({
      $id: 'temp-validation-schema',
      ...extractedSchema,
    });
    
    const valid = validate(data);
    
    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        errors.push({
          path: error.instancePath || '',
          message: error.message || 'Validation failed',
          keyword: error.keyword || 'unknown',
          params: error.params,
        });
      }
    }
    
    return { isValid: valid, errors };
  } catch (err) {
    return { 
      isValid: false, 
      errors: [{ path: '', message: `Schema compilation error: ${err.message}`, keyword: 'compile' }] 
    };
  }
};

/**
 * Format validation errors for display
 * @param {Array<{ path: string, message: string }>} errors - Array of validation errors
 * @returns {string} - Human-readable error string
 */
export const formatValidationErrors = (errors) => {
  if (!errors || errors.length === 0) return '';
  
  return errors.map(err => {
    const pathPrefix = err.path ? `${err.path}: ` : '';
    return `${pathPrefix}${err.message}`;
  }).join('\n');
};

/**
 * Check if JSON string is valid
 * @param {string} jsonString - The JSON string to parse
 * @returns {{ isValid: boolean, data: any, error: string | null }}
 */
export const parseJson = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    return { isValid: true, data, error: null };
  } catch (err) {
    return { isValid: false, data: null, error: err.message };
  }
};

export default {
  validateJsonSchema,
  validateDataAgainstSchema,
  formatValidationErrors,
  parseJson,
};
