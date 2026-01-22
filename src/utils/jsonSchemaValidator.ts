/**
 * JSON Schema Validator utility using Ajv
 * Provides validation for both schema structure and data against schemas
 */

import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import addErrors from 'ajv-errors';

// ============= Types =============

export interface SchemaValidationError {
  path: string;
  message: string;
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: SchemaValidationError[];
  warnings: string[];
}

export interface DataValidationError {
  path: string;
  message: string;
  keyword: string;
  params?: Record<string, unknown>;
}

export interface DataValidationResult {
  isValid: boolean;
  errors: DataValidationError[];
}

export interface JsonParseResult {
  isValid: boolean;
  data: unknown;
  error: string | null;
}

export interface JsonSchemaObject {
  type?: string | string[];
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  items?: JsonSchemaObject;
  additionalProperties?: boolean;
  description?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  default?: unknown;
  oneOf?: JsonSchemaObject[];
  anyOf?: JsonSchemaObject[];
  [key: string]: unknown;
}

export interface WrappedSchema {
  json_schema?: {
    name?: string;
    schema?: JsonSchemaObject;
    json_schema?: {
      schema?: JsonSchemaObject;
    };
  };
  schema?: JsonSchemaObject;
  properties?: Record<string, JsonSchemaObject>;
  type?: string;
}

// ============= Ajv Setup =============

const createAjv = (): Ajv => {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false,
    validateFormats: true,
  });
  
  addFormats(ajv);
  addErrors(ajv);
  
  return ajv;
};

let ajvInstance: Ajv | null = null;

const getAjv = (): Ajv => {
  if (!ajvInstance) {
    ajvInstance = createAjv();
  }
  return ajvInstance;
};

// ============= Schema Extraction =============

/**
 * Extract the actual schema from various wrapper formats
 */
const extractSchema = (input: unknown): JsonSchemaObject | null => {
  if (!input || typeof input !== 'object') return null;
  
  const wrapped = input as WrappedSchema;
  
  // Handle OpenAI format: { json_schema: { name, schema: {...} } }
  if (wrapped.json_schema?.schema) {
    return wrapped.json_schema.schema;
  }
  // Handle wrapped format: { schema: {...} }
  if (wrapped.schema?.properties) {
    return wrapped.schema;
  }
  // Handle direct schema: { type, properties: {...} }
  if (wrapped.properties || wrapped.type) {
    return wrapped as JsonSchemaObject;
  }
  // Handle deeply nested: { json_schema: { json_schema: { schema: {...} } } }
  if (wrapped.json_schema?.json_schema?.schema) {
    return wrapped.json_schema.json_schema.schema;
  }
  
  return input as JsonSchemaObject;
};

// ============= Schema Validation =============

/**
 * Validate that an object is a valid JSON Schema structure
 */
export const validateJsonSchema = (schema: unknown): SchemaValidationResult => {
  const errors: SchemaValidationError[] = [];
  const warnings: string[] = [];
  
  if (!schema) {
    return { isValid: false, errors: [{ path: '', message: 'Schema is empty or undefined' }], warnings };
  }
  
  const extractedSchema = extractSchema(schema);
  if (!extractedSchema) {
    return { isValid: false, errors: [{ path: '', message: 'Could not extract schema from input' }], warnings };
  }
  
  if (typeof extractedSchema !== 'object') {
    return { isValid: false, errors: [{ path: '', message: 'Schema must be an object' }], warnings };
  }
  
  // Check for type
  if (!extractedSchema.type && !extractedSchema.properties && !extractedSchema.oneOf && !extractedSchema.anyOf) {
    warnings.push('Schema should have a "type" property or use composition keywords (oneOf, anyOf)');
  }
  
  // Validate properties structure
  if (extractedSchema.properties) {
    if (typeof extractedSchema.properties !== 'object') {
      errors.push({ path: 'properties', message: '"properties" must be an object' });
    } else {
      for (const [propName, propDef] of Object.entries(extractedSchema.properties)) {
        if (typeof propDef !== 'object' || propDef === null) {
          errors.push({ path: `properties.${propName}`, message: `Property "${propName}" must be an object` });
          continue;
        }
        
        const propSchema = propDef as JsonSchemaObject;
        
        if (propSchema.type && typeof propSchema.type === 'string') {
          const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
          if (!validTypes.includes(propSchema.type)) {
            errors.push({ path: `properties.${propName}.type`, message: `Invalid type "${propSchema.type}" for property "${propName}"` });
          }
        }
        
        // Recursive validation for nested objects
        if (propSchema.type === 'object' && propSchema.properties) {
          const nestedResult = validateJsonSchema(propSchema);
          nestedResult.errors.forEach(err => {
            errors.push({ path: `properties.${propName}.${err.path}`, message: err.message });
          });
          nestedResult.warnings.forEach(w => warnings.push(`properties.${propName}: ${w}`));
        }
        
        // Validate array items
        if (propSchema.type === 'array') {
          if (!propSchema.items) {
            warnings.push(`Array property "${propName}" should have an "items" definition`);
          } else if ((propSchema.items as JsonSchemaObject).type === 'object' && (propSchema.items as JsonSchemaObject).properties) {
            const nestedResult = validateJsonSchema(propSchema.items);
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
    } else if (extractedSchema.properties) {
      for (const reqProp of extractedSchema.required) {
        if (!extractedSchema.properties[reqProp]) {
          warnings.push(`Required property "${reqProp}" is not defined in properties`);
        }
      }
    }
  }
  
  // OpenAI strict mode recommendations
  if (extractedSchema.additionalProperties !== false) {
    warnings.push('For OpenAI strict mode, "additionalProperties" should be set to false');
  }
  
  return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Validate data against a JSON Schema
 */
export const validateDataAgainstSchema = (data: unknown, schema: unknown): DataValidationResult => {
  const errors: DataValidationError[] = [];
  
  if (!schema) {
    return { isValid: false, errors: [{ path: '', message: 'No schema provided', keyword: 'schema' }] };
  }
  
  const extractedSchema = extractSchema(schema);
  if (!extractedSchema) {
    return { isValid: false, errors: [{ path: '', message: 'Could not extract schema', keyword: 'schema' }] };
  }
  
  try {
    const ajv = getAjv();
    
    // Clear any cached schemas
    ajv.removeSchema('temp-validation-schema');
    
    const validate: ValidateFunction = ajv.compile({
      $id: 'temp-validation-schema',
      ...extractedSchema,
    });
    
    const valid = validate(data);
    
    if (!valid && validate.errors) {
      for (const error of validate.errors as ErrorObject[]) {
        errors.push({
          path: error.instancePath || '',
          message: error.message || 'Validation failed',
          keyword: error.keyword || 'unknown',
          params: error.params as Record<string, unknown>,
        });
      }
    }
    
    return { isValid: valid ?? false, errors };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { 
      isValid: false, 
      errors: [{ path: '', message: `Schema compilation error: ${errorMessage}`, keyword: 'compile' }] 
    };
  }
};

/**
 * Format validation errors for display
 */
export const formatValidationErrors = (errors: SchemaValidationError[] | DataValidationError[]): string => {
  if (!errors || errors.length === 0) return '';
  
  return errors.map(err => {
    const pathPrefix = err.path ? `${err.path}: ` : '';
    return `${pathPrefix}${err.message}`;
  }).join('\n');
};

/**
 * Check if JSON string is valid
 */
export const parseJson = (jsonString: string): JsonParseResult => {
  try {
    const data = JSON.parse(jsonString);
    return { isValid: true, data, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { isValid: false, data: null, error: errorMessage };
  }
};

export default {
  validateJsonSchema,
  validateDataAgainstSchema,
  formatValidationErrors,
  parseJson,
};
