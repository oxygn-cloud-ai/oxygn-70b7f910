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

const isDev = import.meta.env.DEV;

const logger = {
  /**
   * Debug level - only logs in development
   * Use for detailed debugging information that would be noisy in production
   */
  debug: (...args) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  /**
   * Info level - only logs in development
   * Use for general informational messages during normal operation
   */
  info: (...args) => {
    if (isDev) {
      console.log('[INFO]', ...args);
    }
  },
  
  /**
   * Warn level - always logs
   * Use for potential issues that don't break functionality
   */
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },
  
  /**
   * Error level - always logs
   * Use for errors that need attention
   */
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
};

export default logger;
