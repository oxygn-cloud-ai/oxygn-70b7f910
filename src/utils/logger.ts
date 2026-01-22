/**
 * Production-safe logging utility.
 * 
 * - debug/info: Only log in development mode (import.meta.env.DEV)
 * - warn/error: Always log (important for production debugging)
 * 
 * Usage:
 *   import logger from '@/utils/logger';
 *   logger.debug('Debug message', data);
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message', error);
 */

const isDev: boolean = import.meta.env.DEV;

interface Logger {
  /**
   * Debug level - only logs in development
   * Use for detailed debugging information that would be noisy in production
   */
  debug: (...args: unknown[]) => void;
  
  /**
   * Info level - only logs in development
   * Use for general informational messages during normal operation
   */
  info: (...args: unknown[]) => void;
  
  /**
   * Warn level - always logs
   * Use for potential issues that don't break functionality
   */
  warn: (...args: unknown[]) => void;
  
  /**
   * Error level - always logs
   * Use for errors that need attention
   */
  error: (...args: unknown[]) => void;
}

const logger: Logger = {
  debug: (...args: unknown[]): void => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info: (...args: unknown[]): void => {
    if (isDev) {
      console.log('[INFO]', ...args);
    }
  },
  
  warn: (...args: unknown[]): void => {
    console.warn('[WARN]', ...args);
  },
  
  error: (...args: unknown[]): void => {
    console.error('[ERROR]', ...args);
  },
};

export default logger;
