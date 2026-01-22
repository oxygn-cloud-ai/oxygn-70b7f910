/**
 * Retry Utilities
 * Functions for retrying failed operations with configurable options
 */

export interface RetryOptions {
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Delay between retries in ms (default: 1000) */
  delay?: number;
  /** Exponential backoff multiplier (optional) */
  backoffMultiplier?: number;
  /** Maximum delay in ms when using backoff */
  maxDelay?: number;
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback called before each retry */
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * Retry a function with configurable options
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    retries = 3,
    delay = 1000,
    backoffMultiplier,
    maxDelay = 30000,
    isRetryable = () => true,
    onRetry,
  } = options;

  let lastError: unknown;
  let currentDelay = delay;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt < retries - 1 && isRetryable(error)) {
        // Call retry callback if provided
        if (onRetry) {
          onRetry(error, attempt + 1);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, currentDelay));

        // Apply exponential backoff if configured
        if (backoffMultiplier) {
          currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
        }
      }
    }
  }

  throw lastError;
};

/**
 * Check if an error is a rate limit error
 */
export const isRateLimitError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('too many requests')
    );
  }
  return false;
};

/**
 * Check if an error is a network/timeout error
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('failed to fetch') ||
      message.includes('econnrefused')
    );
  }
  return false;
};

/**
 * Default retry options for API calls
 */
export const API_RETRY_OPTIONS: RetryOptions = {
  retries: 3,
  delay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
  isRetryable: (error) => isRateLimitError(error) || isNetworkError(error),
};

export default { retry, isRateLimitError, isNetworkError, API_RETRY_OPTIONS };
