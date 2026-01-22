/**
 * Error Handling Service
 * Centralized error handling for Supabase and API operations
 */

import { toast } from '@/components/ui/sonner';

/**
 * Supabase error structure
 */
export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  stack?: string;
}

/**
 * Error handling options
 */
export interface ErrorHandlingOptions {
  showToast?: boolean;
  rethrow?: boolean;
}

/**
 * Handle Supabase errors with consistent logging and user notification
 * @param error - The error object from Supabase
 * @param operation - Description of the operation that failed
 * @param options - Error handling options
 */
export const handleSupabaseError = (
  error: SupabaseError | Error,
  operation: string,
  options: ErrorHandlingOptions = { showToast: true, rethrow: true }
): void => {
  const { showToast = true, rethrow = true } = options;
  
  console.error(`Error ${operation}:`, error);
  
  if (showToast) {
    if (error.message === 'Failed to fetch') {
      toast.error('Network error: Unable to connect to the database. Please check your internet connection.', {
        source: 'errorHandling.handleSupabaseError',
        errorCode: 'NETWORK_ERROR',
        details: JSON.stringify({ operation, error: error?.message, stack: error?.stack }, null, 2),
      } as Record<string, unknown>);
    } else {
      const supabaseError = error as SupabaseError;
      toast.error(`Error ${operation}: ${error.message}`, {
        source: 'errorHandling.handleSupabaseError',
        errorCode: supabaseError?.code || 'SUPABASE_ERROR',
        details: JSON.stringify({ 
          operation, 
          error: error?.message, 
          code: supabaseError?.code, 
          stack: error?.stack 
        }, null, 2),
      } as Record<string, unknown>);
    }
  }
  
  if (rethrow) {
    throw error;
  }
};

/**
 * Create a safe error handler that doesn't rethrow
 */
export const createSafeErrorHandler = (operation: string) => {
  return (error: SupabaseError | Error): void => {
    handleSupabaseError(error, operation, { showToast: true, rethrow: false });
  };
};

/**
 * Wrap an async operation with error handling
 */
export const withErrorHandling = async <T>(
  operation: string,
  fn: () => Promise<T>,
  defaultValue?: T
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    handleSupabaseError(error as SupabaseError, operation, { showToast: true, rethrow: false });
    return defaultValue as T;
  }
};
