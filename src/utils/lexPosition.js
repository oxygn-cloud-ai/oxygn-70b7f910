/**
 * Lexicographic Position Utilities
 * 
 * Uses fractional-indexing to generate string-based positions that sort correctly.
 * This allows unlimited insertions without precision loss.
 */
import { generateKeyBetween } from 'fractional-indexing';

/**
 * Generate a position key at the END of a list
 * @param {string|null} lastKey - The position of the current last item (or null if empty)
 * @returns {string} A new position key that sorts after lastKey
 */
export const generatePositionAtEnd = (lastKey) => {
  return generateKeyBetween(lastKey, null);
};

/**
 * Generate a position key at the START of a list
 * @param {string|null} firstKey - The position of the current first item (or null if empty)
 * @returns {string} A new position key that sorts before firstKey
 */
export const generatePositionAtStart = (firstKey) => {
  return generateKeyBetween(null, firstKey);
};

/**
 * Generate a position key BETWEEN two existing keys
 * @param {string|null} beforeKey - The position of the item before
 * @param {string|null} afterKey - The position of the item after
 * @returns {string} A new position key that sorts between beforeKey and afterKey
 */
export const generatePositionBetween = (beforeKey, afterKey) => {
  return generateKeyBetween(beforeKey, afterKey);
};
