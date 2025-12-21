/**
 * Utility functions for parsing and displaying user-friendly API error messages
 */

// Known error patterns and their user-friendly messages
const ERROR_PATTERNS = [
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
  {
    pattern: /rate limit/i,
    code: 'RATE_LIMITED',
    title: 'Rate Limited',
    message: 'Too many requests. The system will automatically retry.',
    recoverable: true,
  },
  {
    pattern: /conversation_locked/i,
    code: 'CONVERSATION_LOCKED',
    title: 'Conversation Busy',
    message: 'The conversation is currently in use. Retrying...',
    recoverable: true,
  },
  {
    pattern: /invalid.*api.*key/i,
    code: 'INVALID_API_KEY',
    title: 'Invalid API Key',
    message: 'The OpenAI API key is invalid. Please check your configuration.',
    recoverable: false,
  },
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
  {
    pattern: /network|fetch|connection|timeout/i,
    code: 'NETWORK_ERROR',
    title: 'Network Error',
    message: 'Unable to connect. Please check your internet connection.',
    recoverable: true,
  },
  {
    pattern: /server.*error|internal.*error|500/i,
    code: 'SERVER_ERROR',
    title: 'Server Error',
    message: 'A server error occurred. Please try again.',
    recoverable: true,
  },
];

/**
 * Parse an error and return user-friendly information
 * @param {Error|string} error - The error to parse
 * @returns {{code: string, title: string, message: string, recoverable: boolean, original: string}}
 */
export const parseApiError = (error) => {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';
  
  // Check against known patterns
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
  
  // Default fallback for unknown errors
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
 * @param {Error|string} error - The error to check
 * @returns {boolean}
 */
export const isRecoverableError = (error) => {
  return parseApiError(error).recoverable;
};

/**
 * Check if error is a quota/billing issue
 * @param {Error|string} error - The error to check
 * @returns {boolean}
 */
export const isQuotaError = (error) => {
  const parsed = parseApiError(error);
  return parsed.code === 'QUOTA_EXCEEDED';
};

/**
 * Check if error is a rate limit
 * @param {Error|string} error - The error to check
 * @returns {boolean}
 */
export const isRateLimitError = (error) => {
  const errorMessage = typeof error === 'string' ? error : error?.message || '';
  return /rate limit/i.test(errorMessage);
};

/**
 * Format error for display in toast or dialog
 * @param {Error|string} error - The error to format
 * @param {string} [promptName] - Optional prompt name for context
 * @returns {{title: string, description: string}}
 */
export const formatErrorForDisplay = (error, promptName) => {
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
