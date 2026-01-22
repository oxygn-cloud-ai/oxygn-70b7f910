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
    // Add random suffix to prevent collisions within same millisecond
    return `z${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
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
    // Fallback: Use 'A0' prefix - matches fractional-indexing's smallest integer format
    // 'A' heads represent smallest integers in the BASE_62 space
    return `A0${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
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
    
    // Smart fallback that respects both bounds
    if (beforeKey && afterKey) {
      const candidate = `${beforeKey}V`;
      if (candidate < afterKey) {
        return candidate;
      }
      // CRITICAL: Data is corrupted - use timestamp fallback with explicit return
      console.warn('[lexPosition] Corrupted position data - emergency fallback');
      return `${beforeKey}${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
    }
    
    if (beforeKey) {
      return `${beforeKey}V`;
    }
    if (afterKey) {
      // Sort before afterKey - use smallest valid prefix
      return `A0${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
    }
    
    return `a0`;  // Standard midpoint when both are null
  }
};
