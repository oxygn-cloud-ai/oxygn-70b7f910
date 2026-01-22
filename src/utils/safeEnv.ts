/**
 * Safe environment variable accessor utilities.
 * Prevents crashes when environment variables are undefined.
 */

/**
 * Safely get an environment variable with a fallback value.
 * @param {string} key - The environment variable key (e.g., 'VITE_DEBUG')
 * @param {any} fallback - The fallback value if the key is undefined
 * @returns {any} The environment variable value or the fallback
 */
export const getEnv = (key, fallback = undefined) => {
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
 * @param {string} key - The environment variable key
 * @returns {string} The environment variable value
 * @throws {Error} If the variable is not set
 */
export const getEnvOrThrow = (key) => {
  const value = getEnv(key);
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

/**
 * Check if an environment variable is set (not undefined, null, or empty).
 * @param {string} key - The environment variable key
 * @returns {boolean} True if the variable is set
 */
export const hasEnv = (key) => {
  const value = getEnv(key);
  return value !== undefined && value !== null && value !== '';
};

/**
 * Get multiple environment variables at once.
 * @param {string[]} keys - Array of environment variable keys
 * @param {any} fallback - Default fallback for all keys
 * @returns {Object} Object with key-value pairs
 */
export const getEnvMany = (keys, fallback = 'Not set') => {
  const result = {};
  for (const key of keys) {
    result[key] = getEnv(key, fallback);
  }
  return result;
};
