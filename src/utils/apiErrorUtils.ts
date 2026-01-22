/**
 * Utility functions for parsing and displaying user-friendly API error messages
 */

// ============= Types =============

export interface ErrorPattern {
  pattern: RegExp;
  code: string;
  title: string;
  message: string;
  recoverable: boolean;
}

export interface ParsedApiError {
  code: string;
  title: string;
  message: string;
  recoverable: boolean;
  original: string;
}

export interface FormattedError {
  title: string;
  description: string;
  code: string;
  recoverable: boolean;
}

export interface ErrorInput {
  message?: string;
  error_code?: string;
  code?: string;
}

// ============= Error Patterns =============

const ERROR_PATTERNS: ErrorPattern[] = [
  // === OpenAI Quota/Billing (most specific first) ===
  {
    pattern: /exceeded your current quota/i,
    code: 'QUOTA_EXCEEDED',
    title: 'OpenAI Quota Exceeded',
    message: 'Your OpenAI API quota has been exceeded. Please check your billing settings at platform.openai.com.',
    recoverable: false,
  },
  {
    pattern: /insufficient_quota/i,
    code: 'QUOTA_EXCEEDED',
    title: 'OpenAI Quota Exceeded',
    message: 'Your OpenAI API quota has been exceeded. Please add credits to your OpenAI account.',
    recoverable: false,
  },
  
  // === Rate Limiting ===
  {
    pattern: /rate limit/i,
    code: 'RATE_LIMITED',
    title: 'Rate Limited',
    message: 'Too many requests. The system will automatically retry.',
    recoverable: true,
  },
  
  // === Timeout ===
  {
    pattern: /idle.?timeout|no response data received|connection may have stalled/i,
    code: 'IDLE_TIMEOUT',
    title: 'Response Timeout',
    message: 'The AI took too long to respond. This may happen with complex prompts or when the service is busy. Please try again.',
    recoverable: true,
  },
  
  // === Conversation State ===
  {
    pattern: /conversation_locked|another process.*operating|conversation.*currently in use/i,
    code: 'CONVERSATION_BUSY',
    title: 'Conversation Busy',
    message: 'The conversation is processing another request. Please wait a moment and try again.',
    recoverable: true,
  },
  
  // === MANUS-SPECIFIC ERRORS ===
  {
    pattern: /MANUS_NOT_CONFIGURED|manus.*not configured/i,
    code: 'MANUS_NOT_CONFIGURED',
    title: 'Manus Not Configured',
    message: 'Configure your Manus API key in Settings → Integrations.',
    recoverable: false,
  },
  {
    pattern: /MANUS_INVALID_KEY|invalid manus.*key|invalid api key.*code[:\s]*16|code[:\s]*16.*invalid api key|"message"\s*:\s*"invalid api key/i,
    code: 'MANUS_INVALID_KEY',
    title: 'Invalid Manus API Key',
    message: 'Your Manus API key is invalid or expired. Update it in Settings → Integrations.',
    recoverable: false,
  },
  {
    pattern: /MANUS_API_ERROR|manus api error/i,
    code: 'MANUS_API_ERROR',
    title: 'Manus API Error',
    message: 'The Manus API returned an error. Try again or check your task configuration.',
    recoverable: true,
  },
  {
    pattern: /MANUS_TIMEOUT|manus.*timed? ?out/i,
    code: 'MANUS_TIMEOUT',
    title: 'Manus Task Timeout',
    message: 'The Manus task took too long to complete. Complex tasks may exceed time limits.',
    recoverable: false,
  },
  {
    pattern: /MANUS_TASK_FAILED|manus task failed/i,
    code: 'MANUS_TASK_FAILED',
    title: 'Manus Task Failed',
    message: 'The Manus task failed. Check the task URL for details.',
    recoverable: false,
  },
  {
    pattern: /MANUS_TASK_CANCELLED|manus task cancelled/i,
    code: 'MANUS_TASK_CANCELLED',
    title: 'Manus Task Cancelled',
    message: 'The Manus task was cancelled.',
    recoverable: false,
  },
  {
    pattern: /MANUS_REQUIRES_INPUT|input.?required|interactive/i,
    code: 'MANUS_REQUIRES_INPUT',
    title: 'Interactive Input Required',
    message: 'Manus requires interactive input which is not supported. Use a different task mode.',
    recoverable: false,
  },
  {
    pattern: /MANUS_NOT_SUPPORTED|manus.*requires async|manus.*cascade/i,
    code: 'MANUS_NOT_SUPPORTED',
    title: 'Manus Requires Cascade',
    message: 'Manus models require cascade execution. Use the cascade run button instead of direct prompt execution.',
    recoverable: false,
  },
  {
    pattern: /MISSING_FIELD|required field/i,
    code: 'MISSING_FIELD',
    title: 'Missing Required Field',
    message: 'The request is missing a required field. Check your prompt configuration.',
    recoverable: false,
  },
  {
    pattern: /POLL_TIMEOUT|polling timed out/i,
    code: 'POLL_TIMEOUT',
    title: 'Response Timeout',
    message: 'The AI took too long to respond. Try a simpler prompt or shorter output.',
    recoverable: false,
  },
  {
    pattern: /unmarshal.*message|proto.*syntax error/i,
    code: 'MANUS_PAYLOAD_ERROR',
    title: 'Webhook Configuration Error',
    message: 'Failed to register webhook due to a configuration issue. Please contact support.',
    recoverable: false,
  },
  {
    pattern: /webhook.*registration failed|manus.*registration failed/i,
    code: 'MANUS_REGISTRATION_FAILED',
    title: 'Webhook Registration Failed',
    message: 'Could not register webhook with Manus. Please verify your API key and try again.',
    recoverable: true,
  },
  
  // === GENERIC API KEY ===
  {
    pattern: /invalid.*api.*key/i,
    code: 'INVALID_API_KEY',
    title: 'Invalid API Key',
    message: 'The OpenAI API key is invalid. Please check your configuration.',
    recoverable: false,
  },
  
  // === Model/Content Errors ===
  {
    pattern: /model.*not.*found/i,
    code: 'MODEL_NOT_FOUND',
    title: 'Model Not Available',
    message: 'The requested AI model is not available. Try a different model.',
    recoverable: false,
  },
  {
    pattern: /context.*length.*exceeded/i,
    code: 'CONTEXT_TOO_LONG',
    title: 'Content Too Long',
    message: 'The prompt or context is too long for the selected model. Try reducing the content.',
    recoverable: false,
  },
  {
    pattern: /no message.*content/i,
    code: 'NO_MESSAGE_CONTENT',
    title: 'Empty Prompt',
    message: 'The prompt has no content. Add text to the user or admin prompt field.',
    recoverable: false,
  },
  
  // === Network Errors ===
  {
    pattern: /failed to fetch|network error|ERR_NETWORK|ECONNREFUSED|ENOTFOUND|net::ERR_|NetworkError/i,
    code: 'NETWORK_ERROR',
    title: 'Network Error',
    message: 'Unable to connect. Please check your internet connection.',
    recoverable: true,
  },
  
  // === Server Errors ===
  {
    pattern: /server.*error|internal.*error|error.*500|status.*500|code.*500|\b500\b.*error/i,
    code: 'SERVER_ERROR',
    title: 'Server Error',
    message: 'A server error occurred. Please try again.',
    recoverable: true,
  },
];

// ============= Error Parsing =============

/**
 * Parse an error and return user-friendly information
 */
export const parseApiError = (error: string | Error | ErrorInput): ParsedApiError => {
  const errorMessage = typeof error === 'string' 
    ? error 
    : (error as ErrorInput)?.message || 'Unknown error';
  
  // Priority 1: Match on explicit error_code if present
  const errorCode = (error as ErrorInput)?.error_code || (error as ErrorInput)?.code;
  if (errorCode) {
    const matchByCode = ERROR_PATTERNS.find(p => p.code === errorCode);
    if (matchByCode) {
      return {
        code: matchByCode.code,
        title: matchByCode.title,
        message: matchByCode.message,
        recoverable: matchByCode.recoverable,
        original: errorMessage,
      };
    }
  }
  
  // Priority 2: Match on error message pattern
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(errorMessage)) {
      return {
        code: pattern.code,
        title: pattern.title,
        message: pattern.message,
        recoverable: pattern.recoverable,
        original: errorMessage,
      };
    }
  }
  
  // Default fallback
  return {
    code: 'UNKNOWN_ERROR',
    title: 'Error',
    message: errorMessage,
    recoverable: true,
    original: errorMessage,
  };
};

/**
 * Check if an error is recoverable (can be retried)
 */
export const isRecoverableError = (error: string | Error | ErrorInput): boolean => {
  return parseApiError(error).recoverable;
};

/**
 * Check if error is a quota/billing issue
 */
export const isQuotaError = (error: string | Error | ErrorInput): boolean => {
  const parsed = parseApiError(error);
  return parsed.code === 'QUOTA_EXCEEDED';
};

/**
 * Check if error is a rate limit
 */
export const isRateLimitError = (error: string | Error | ErrorInput): boolean => {
  const errorMessage = typeof error === 'string' 
    ? error 
    : (error as ErrorInput)?.message || '';
  return /rate limit/i.test(errorMessage);
};

/**
 * Format error for display in toast or dialog
 */
export const formatErrorForDisplay = (
  error: string | Error | ErrorInput,
  promptName?: string
): FormattedError => {
  const parsed = parseApiError(error);
  
  const title = promptName 
    ? `${parsed.title}: ${promptName}`
    : parsed.title;
  
  return {
    title,
    description: parsed.message,
    code: parsed.code,
    recoverable: parsed.recoverable,
  };
};

export default {
  parseApiError,
  isRecoverableError,
  isQuotaError,
  isRateLimitError,
  formatErrorForDisplay,
};
