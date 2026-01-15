/**
 * Lexicographic Position Utilities
 * 
 * Uses fractional-indexing to generate string-based positions that sort correctly.
 * This allows unlimited insertions without precision loss.
 * 
 * Includes defensive error handling for corrupted position_lex values.
 */
import { generateKeyBetween } from 'fractional-indexing';

/**
 * Generate a position key at the END of a list
 * @param {string|null} lastKey - The position of the current last item (or null if empty)
 * @returns {string} A new position key that sorts after lastKey
 */
export const generatePositionAtEnd = (lastKey) => {
  try {
    return generateKeyBetween(lastKey, null);
  } catch (e) {
    console.error('[lexPosition] generatePositionAtEnd failed:', { lastKey, error: e.message });
    // Fallback: generate a timestamp-based key that will sort at the end
    return `z${Date.now().toString(36)}`;
  }
};

/**
 * Generate a position key at the START of a list
 * @param {string|null} firstKey - The position of the current first item (or null if empty)
 * @returns {string} A new position key that sorts before firstKey
 */
export const generatePositionAtStart = (firstKey) => {
  try {
    return generateKeyBetween(null, firstKey);
  } catch (e) {
    console.error('[lexPosition] generatePositionAtStart failed:', { firstKey, error: e.message });
    // Fallback: generate a key that will sort at the start
    return `A${Date.now().toString(36)}`;
  }
};

/**
 * Generate a position key BETWEEN two existing keys
 * @param {string|null} beforeKey - The position of the item before
 * @param {string|null} afterKey - The position of the item after
 * @returns {string} A new position key that sorts between beforeKey and afterKey
 */
export const generatePositionBetween = (beforeKey, afterKey) => {
  try {
    return generateKeyBetween(beforeKey, afterKey);
  } catch (e) {
    console.error('[lexPosition] generatePositionBetween failed:', { beforeKey, afterKey, error: e.message });
    // Fallback: append to the before key if available
    if (beforeKey) {
      return `${beforeKey}m`;
    }
    return `m${Date.now().toString(36)}`;
  }
};
