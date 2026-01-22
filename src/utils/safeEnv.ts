/**
 * Safe environment variable accessor utilities.
 * Prevents crashes when environment variables are undefined.
 */

/**
 * Safely get an environment variable with a fallback value.
 * @param key - The environment variable key (e.g., 'VITE_DEBUG')
 * @param fallback - The fallback value if the key is undefined
 * @returns The environment variable value or the fallback
 */
export const getEnv = <T = string>(key: string, fallback?: T): string | T | undefined => {
  try {
    const value = import.meta.env?.[key];
    return value !== undefined ? value : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Get an environment variable or throw an error if not set.
 * Use this only for truly required variables.
 * @param key - The environment variable key
 * @returns The environment variable value
 * @throws Error if the variable is not set
 */
export const getEnvOrThrow = (key: string): string => {
  const value = getEnv(key);
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value as string;
};

/**
 * Check if an environment variable is set (not undefined, null, or empty).
 * @param key - The environment variable key
 * @returns True if the variable is set
 */
export const hasEnv = (key: string): boolean => {
  const value = getEnv(key);
  return value !== undefined && value !== null && value !== '';
};

/**
 * Get multiple environment variables at once.
 * @param keys - Array of environment variable keys
 * @param fallback - Default fallback for all keys
 * @returns Object with key-value pairs
 */
export const getEnvMany = (keys: string[], fallback: string = 'Not set'): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const key of keys) {
    result[key] = (getEnv(key, fallback) as string) ?? fallback;
  }
  return result;
};

/**
 * Get a boolean environment variable
 * @param key - The environment variable key
 * @param fallback - Default value if not set
 * @returns Boolean value
 */
export const getEnvBool = (key: string, fallback: boolean = false): boolean => {
  const value = getEnv(key);
  if (value === undefined || value === null) return fallback;
  return value === 'true' || value === '1' || value === 'yes';
};

/**
 * Get a number environment variable
 * @param key - The environment variable key
 * @param fallback - Default value if not set or invalid
 * @returns Number value
 */
export const getEnvNumber = (key: string, fallback: number): number => {
  const value = getEnv(key);
  if (value === undefined || value === null) return fallback;
  const num = parseInt(value as string, 10);
  return isNaN(num) ? fallback : num;
};
