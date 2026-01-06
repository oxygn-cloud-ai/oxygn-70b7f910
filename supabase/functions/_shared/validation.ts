/**
 * Shared Input Validation Schemas
 * 
 * Lightweight validation utilities for edge functions.
 * Uses simple runtime checks rather than heavy Zod dependency
 * for faster cold starts.
 */

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function isValidUUID(value: unknown): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function isNonEmptyString(value: unknown, maxLength = 100000): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

export function isOptionalString(value: unknown, maxLength = 100000): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.length <= maxLength);
}

export function isValidAction(value: unknown, allowedActions: string[]): boolean {
  return typeof value === 'string' && allowedActions.includes(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isOptionalObject(value: unknown): value is Record<string, unknown> | undefined {
  return value === undefined || value === null || isObject(value);
}

export function isPositiveInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max;
}

export function isOptionalPositiveInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): boolean {
  return value === undefined || value === null || isPositiveInteger(value, max);
}

// ============================================================================
// Thread Manager Validation
// ============================================================================
export function validateThreadManagerInput(body: any): ValidationResult {
  const { action } = body;
  
  const validActions = ['create', 'list', 'delete', 'get_messages', 'rename'];
  if (!isValidAction(action, validActions)) {
    return { valid: false, error: `Invalid action. Use: ${validActions.join(', ')}` };
  }
  
  switch (action) {
    case 'create':
      if (body.name !== undefined && !isOptionalString(body.name, 500)) {
        return { valid: false, error: 'name must be a string with max 500 characters' };
      }
      if (body.root_prompt_row_id && !isValidUUID(body.root_prompt_row_id)) {
        return { valid: false, error: 'root_prompt_row_id must be a valid UUID' };
      }
      break;
      
    case 'list':
      if (body.assistant_row_id && !isValidUUID(body.assistant_row_id)) {
        return { valid: false, error: 'assistant_row_id must be a valid UUID' };
      }
      if (body.root_prompt_row_id && !isValidUUID(body.root_prompt_row_id)) {
        return { valid: false, error: 'root_prompt_row_id must be a valid UUID' };
      }
      break;
      
    case 'delete':
    case 'get_messages':
      if (!isValidUUID(body.thread_row_id)) {
        return { valid: false, error: 'thread_row_id is required and must be a valid UUID' };
      }
      if (action === 'get_messages' && body.limit !== undefined) {
        if (!isOptionalPositiveInteger(body.limit, 1000)) {
          return { valid: false, error: 'limit must be a positive integer <= 1000' };
        }
      }
      break;
      
    case 'rename':
      if (!isValidUUID(body.thread_row_id)) {
        return { valid: false, error: 'thread_row_id is required and must be a valid UUID' };
      }
      if (!isNonEmptyString(body.name, 500)) {
        return { valid: false, error: 'name is required and must be a string with max 500 characters' };
      }
      break;
  }
  
  return { valid: true };
}

// ============================================================================
// Credentials Manager Validation
// ============================================================================
export function validateCredentialsManagerInput(body: any): ValidationResult {
  const { action } = body;
  
  const validActions = ['get_status', 'set', 'delete', 'list_services'];
  if (!isValidAction(action, validActions)) {
    return { valid: false, error: `Invalid action. Use: ${validActions.join(', ')}` };
  }
  
  // Service type validation (limited character set)
  const validServicePattern = /^[a-z0-9_-]{1,50}$/;
  
  switch (action) {
    case 'get_status':
      if (!body.service || !validServicePattern.test(body.service)) {
        return { valid: false, error: 'service is required and must be alphanumeric with max 50 characters' };
      }
      break;
      
    case 'set':
      if (!body.service || !validServicePattern.test(body.service)) {
        return { valid: false, error: 'service is required and must be alphanumeric with max 50 characters' };
      }
      if (!isNonEmptyString(body.key, 100)) {
        return { valid: false, error: 'key is required and must be a string with max 100 characters' };
      }
      // Value can be longer (API tokens, etc) but cap at 10KB
      if (!isNonEmptyString(body.value, 10000)) {
        return { valid: false, error: 'value is required and must be a string with max 10000 characters' };
      }
      break;
      
    case 'delete':
      if (!body.service || !validServicePattern.test(body.service)) {
        return { valid: false, error: 'service is required and must be alphanumeric with max 50 characters' };
      }
      if (body.key !== undefined && !isOptionalString(body.key, 100)) {
        return { valid: false, error: 'key must be a string with max 100 characters' };
      }
      break;
  }
  
  return { valid: true };
}

// ============================================================================
// Execution Manager Validation
// ============================================================================
export function validateExecutionManagerInput(body: any): ValidationResult {
  const { action } = body;
  
  const validActions = [
    'start_trace', 'create_span', 'complete_span', 'fail_span', 
    'complete_trace', 'check_rate_limit', 'cancel_response', 'cleanup'
  ];
  if (!isValidAction(action, validActions)) {
    return { valid: false, error: `Invalid action. Use: ${validActions.join(', ')}` };
  }
  
  switch (action) {
    case 'start_trace':
      if (!isValidUUID(body.entry_prompt_row_id)) {
        return { valid: false, error: 'entry_prompt_row_id is required and must be a valid UUID' };
      }
      const validExecutionTypes = ['single', 'cascade_top', 'cascade_child'];
      if (!isValidAction(body.execution_type, validExecutionTypes)) {
        return { valid: false, error: `execution_type must be one of: ${validExecutionTypes.join(', ')}` };
      }
      break;
      
    case 'create_span':
      if (!isValidUUID(body.trace_id)) {
        return { valid: false, error: 'trace_id is required and must be a valid UUID' };
      }
      const validSpanTypes = ['generation', 'retry', 'tool_call', 'action', 'error'];
      if (!isValidAction(body.span_type, validSpanTypes)) {
        return { valid: false, error: `span_type must be one of: ${validSpanTypes.join(', ')}` };
      }
      break;
      
    case 'complete_span':
    case 'fail_span':
      if (!isValidUUID(body.span_id)) {
        return { valid: false, error: 'span_id is required and must be a valid UUID' };
      }
      break;
      
    case 'complete_trace':
      if (!isValidUUID(body.trace_id)) {
        return { valid: false, error: 'trace_id is required and must be a valid UUID' };
      }
      const validTraceStatuses = ['completed', 'failed', 'cancelled'];
      if (!isValidAction(body.status, validTraceStatuses)) {
        return { valid: false, error: `status must be one of: ${validTraceStatuses.join(', ')}` };
      }
      break;
      
    case 'check_rate_limit':
      if (!isNonEmptyString(body.endpoint, 200)) {
        return { valid: false, error: 'endpoint is required and must be a string' };
      }
      break;
      
    case 'cancel_response':
      if (!isNonEmptyString(body.response_id, 100)) {
        return { valid: false, error: 'response_id is required' };
      }
      break;
  }
  
  return { valid: true };
}

// ============================================================================
// Confluence Manager Validation
// ============================================================================
export function validateConfluenceManagerInput(body: any): ValidationResult {
  const { action } = body;
  
  const validActions = [
    'test-connection', 'list-spaces', 'search-pages', 'get-space-tree',
    'get-children', 'get-page', 'create-page', 'update-page', 
    'get-templates', 'get-template', 'find-unique-title'
  ];
  if (!isValidAction(action, validActions)) {
    return { valid: false, error: `Invalid action. Use: ${validActions.join(', ')}` };
  }
  
  // Validate common params based on action
  switch (action) {
    case 'search-pages':
      if (!isNonEmptyString(body.query, 500)) {
        return { valid: false, error: 'query is required and must be a string with max 500 characters' };
      }
      break;
      
    case 'get-space-tree':
    case 'get-templates':
      if (!isNonEmptyString(body.spaceKey, 50)) {
        return { valid: false, error: 'spaceKey is required' };
      }
      break;
      
    case 'get-children':
    case 'get-page':
    case 'update-page':
    case 'get-template':
      if (!isNonEmptyString(body.pageId, 50)) {
        return { valid: false, error: 'pageId is required' };
      }
      break;
      
    case 'create-page':
      if (!isNonEmptyString(body.spaceKey, 50)) {
        return { valid: false, error: 'spaceKey is required' };
      }
      if (!isNonEmptyString(body.title, 500)) {
        return { valid: false, error: 'title is required and must be a string with max 500 characters' };
      }
      // Body can be large (up to 1MB for rich content)
      if (!isNonEmptyString(body.body, 1000000)) {
        return { valid: false, error: 'body is required and must be a string with max 1MB' };
      }
      break;
      
    case 'find-unique-title':
      if (!isNonEmptyString(body.spaceKey, 50)) {
        return { valid: false, error: 'spaceKey is required' };
      }
      if (!isNonEmptyString(body.baseTitle, 500)) {
        return { valid: false, error: 'baseTitle is required and must be a string with max 500 characters' };
      }
      break;
  }
  
  return { valid: true };
}
