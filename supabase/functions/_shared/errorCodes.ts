/**
 * Unified error codes for all edge functions
 * Provides consistent error handling across OpenAI and Manus integrations
 */

export const ERROR_CODES = {
  // Authentication & Configuration
  AUTH_MISSING: 'AUTH_MISSING',
  AUTH_INVALID: 'AUTH_INVALID',
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_KEY_INVALID: 'API_KEY_INVALID',
  CONFIG_ERROR: 'CONFIG_ERROR',
  
  // Validation
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FIELD: 'INVALID_FIELD',
  INVALID_PROMPT: 'INVALID_PROMPT',
  PROMPT_NOT_FOUND: 'PROMPT_NOT_FOUND',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  
  // Rate Limiting
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // Timeouts
  TIMEOUT: 'TIMEOUT',
  STREAM_TIMEOUT: 'STREAM_TIMEOUT',
  IDLE_TIMEOUT: 'IDLE_TIMEOUT',
  POLL_TIMEOUT: 'POLL_TIMEOUT',
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
  
  // API Errors
  API_CALL_FAILED: 'API_CALL_FAILED',
  STREAM_ERROR: 'STREAM_ERROR',
  CANCELLED: 'CANCELLED',
  
  // Response Processing
  RESPONSE_INCOMPLETE: 'RESPONSE_INCOMPLETE',
  REQUIRES_ACTION_UNSUPPORTED: 'REQUIRES_ACTION_UNSUPPORTED',
  
  // OpenAI-Specific
  OPENAI_NOT_CONFIGURED: 'OPENAI_NOT_CONFIGURED',
  OPENAI_INVALID_KEY: 'OPENAI_INVALID_KEY',
  OPENAI_API_ERROR: 'OPENAI_API_ERROR',
  
  // Gemini-Specific
  GEMINI_NOT_CONFIGURED: 'GEMINI_NOT_CONFIGURED',
  GEMINI_INVALID_KEY: 'GEMINI_INVALID_KEY',
  
  // Manus-Specific
  MANUS_NOT_CONFIGURED: 'MANUS_NOT_CONFIGURED',
  MANUS_INVALID_KEY: 'MANUS_INVALID_KEY',
  MANUS_API_ERROR: 'MANUS_API_ERROR',
  MANUS_TIMEOUT: 'MANUS_TIMEOUT',
  MANUS_TASK_FAILED: 'MANUS_TASK_FAILED',
  MANUS_TASK_CANCELLED: 'MANUS_TASK_CANCELLED',
  MANUS_REQUIRES_INPUT: 'MANUS_REQUIRES_INPUT',
  MANUS_NOT_SUPPORTED: 'MANUS_NOT_SUPPORTED',
  
  // Database
  DB_INSERT_FAILED: 'DB_INSERT_FAILED',
  DB_UPDATE_FAILED: 'DB_UPDATE_FAILED',
  
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Metadata for each error code
export const ERROR_METADATA: Record<ErrorCode, { 
  httpStatus: number; 
  recoverable: boolean; 
  userMessage: string;
}> = {
  AUTH_MISSING: { httpStatus: 401, recoverable: false, userMessage: 'Authentication required' },
  AUTH_INVALID: { httpStatus: 401, recoverable: false, userMessage: 'Invalid or expired session' },
  API_KEY_MISSING: { httpStatus: 400, recoverable: false, userMessage: 'API key not configured' },
  API_KEY_INVALID: { httpStatus: 401, recoverable: false, userMessage: 'Invalid API key' },
  CONFIG_ERROR: { httpStatus: 500, recoverable: false, userMessage: 'Server configuration error' },
  
  MISSING_FIELD: { httpStatus: 400, recoverable: false, userMessage: 'Required field missing' },
  INVALID_FIELD: { httpStatus: 400, recoverable: false, userMessage: 'Invalid field value' },
  INVALID_PROMPT: { httpStatus: 400, recoverable: false, userMessage: 'Invalid prompt configuration' },
  PROMPT_NOT_FOUND: { httpStatus: 404, recoverable: false, userMessage: 'Prompt not found' },
  MODEL_NOT_FOUND: { httpStatus: 400, recoverable: false, userMessage: 'Model not found or inactive' },
  
  RATE_LIMITED: { httpStatus: 429, recoverable: true, userMessage: 'Rate limited - please wait' },
  QUOTA_EXCEEDED: { httpStatus: 429, recoverable: false, userMessage: 'API quota exceeded' },
  
  TIMEOUT: { httpStatus: 504, recoverable: true, userMessage: 'Request timed out' },
  STREAM_TIMEOUT: { httpStatus: 504, recoverable: true, userMessage: 'Stream connection timed out' },
  IDLE_TIMEOUT: { httpStatus: 504, recoverable: true, userMessage: 'Connection stalled' },
  POLL_TIMEOUT: { httpStatus: 504, recoverable: false, userMessage: 'Response took too long' },
  EXECUTION_TIMEOUT: { httpStatus: 504, recoverable: false, userMessage: 'Execution time limit reached' },
  
  API_CALL_FAILED: { httpStatus: 502, recoverable: true, userMessage: 'API call failed' },
  STREAM_ERROR: { httpStatus: 502, recoverable: true, userMessage: 'Stream error occurred' },
  CANCELLED: { httpStatus: 499, recoverable: false, userMessage: 'Request cancelled' },
  
  RESPONSE_INCOMPLETE: { httpStatus: 200, recoverable: true, userMessage: 'Response was incomplete' },
  REQUIRES_ACTION_UNSUPPORTED: { httpStatus: 400, recoverable: false, userMessage: 'Tool actions not supported' },
  
  OPENAI_NOT_CONFIGURED: { httpStatus: 400, recoverable: false, userMessage: 'OpenAI API key not configured. Add your key in Settings → Integrations → OpenAI.' },
  OPENAI_INVALID_KEY: { httpStatus: 401, recoverable: false, userMessage: 'Invalid OpenAI API key' },
  OPENAI_API_ERROR: { httpStatus: 502, recoverable: true, userMessage: 'OpenAI API error' },
  GEMINI_NOT_CONFIGURED: { httpStatus: 400, recoverable: false, userMessage: 'Gemini API key not configured. Add your key in Settings → Integrations.' },
  GEMINI_INVALID_KEY: { httpStatus: 401, recoverable: false, userMessage: 'Invalid Gemini API key' },
  MANUS_NOT_CONFIGURED: { httpStatus: 400, recoverable: false, userMessage: 'Manus not configured' },
  MANUS_INVALID_KEY: { httpStatus: 401, recoverable: false, userMessage: 'Invalid Manus API key' },
  MANUS_API_ERROR: { httpStatus: 502, recoverable: true, userMessage: 'Manus API error' },
  MANUS_TIMEOUT: { httpStatus: 504, recoverable: false, userMessage: 'Manus task timed out' },
  MANUS_TASK_FAILED: { httpStatus: 502, recoverable: false, userMessage: 'Manus task failed' },
  MANUS_TASK_CANCELLED: { httpStatus: 499, recoverable: false, userMessage: 'Manus task cancelled' },
  MANUS_REQUIRES_INPUT: { httpStatus: 400, recoverable: false, userMessage: 'Manus requires interactive input' },
  MANUS_NOT_SUPPORTED: { httpStatus: 400, recoverable: false, userMessage: 'Manus models require async execution' },
  
  DB_INSERT_FAILED: { httpStatus: 500, recoverable: true, userMessage: 'Database insert failed' },
  DB_UPDATE_FAILED: { httpStatus: 500, recoverable: true, userMessage: 'Database update failed' },
  
  INTERNAL_ERROR: { httpStatus: 500, recoverable: true, userMessage: 'Internal server error' },
  UNKNOWN_ERROR: { httpStatus: 500, recoverable: true, userMessage: 'An unexpected error occurred' },
};

/**
 * Build standardized error response object
 */
export function buildErrorResponse(
  code: ErrorCode, 
  details?: string,
  extra?: Record<string, unknown>
): {
  error: string;
  error_code: ErrorCode;
  recoverable: boolean;
  details?: string;
} & Record<string, unknown> {
  const meta = ERROR_METADATA[code];
  return {
    error: details || meta.userMessage,
    error_code: code,
    recoverable: meta.recoverable,
    ...(details ? { details } : {}),
    ...extra,
  };
}

/**
 * Get HTTP status for error code
 */
export function getHttpStatus(code: ErrorCode): number {
  return ERROR_METADATA[code]?.httpStatus || 500;
}

/**
 * Map Manus stop_reason to error code
 */
export function mapManusStopReasonToErrorCode(stopReason: string): ErrorCode | null {
  switch (stopReason) {
    case 'finish':      // Manus API uses 'finish' for successful completion
      return null;
    case 'failed':
      return ERROR_CODES.MANUS_TASK_FAILED;
    case 'cancelled':
      return ERROR_CODES.MANUS_TASK_CANCELLED;
    case 'ask':         // Manus API uses 'ask' for input required
      return ERROR_CODES.MANUS_REQUIRES_INPUT;
    case 'timeout':
      return ERROR_CODES.MANUS_TIMEOUT;
    default:
      console.warn(`[errorCodes] Unknown Manus stop_reason: ${stopReason}`);
      return ERROR_CODES.UNKNOWN_ERROR;
  }
}

/**
 * Map Manus stop_reason to task status
 */
export function mapManusStopReasonToStatus(stopReason: string): string {
  switch (stopReason) {
    case 'finish':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'ask':
      return 'running';  // Keep running since it needs input
    case 'timeout':
      return 'failed';
    default:
      return 'failed';
  }
}
