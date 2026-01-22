/**
 * Lexicographic Position Utilities
 * Functions for generating fractional-indexing position keys
 */

import { generateKeyBetween } from 'fractional-indexing';

/**
 * Generate a position key at the end of a list
 * @param lastKey - The current last key in the list (null if list is empty)
 * @returns A new key that sorts after lastKey
 */
export const generatePositionAtEnd = (lastKey: string | null): string => {
  try {
    return generateKeyBetween(lastKey, null);
  } catch (e) {
    // Fallback for corrupted keys - use timestamp with random suffix
    console.warn('Fallback position generation (end):', e);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `z${timestamp}${random}`;
  }
};

/**
 * Generate a position key at the start of a list
 * @param firstKey - The current first key in the list (null if list is empty)
 * @returns A new key that sorts before firstKey
 */
export const generatePositionAtStart = (firstKey: string | null): string => {
  try {
    return generateKeyBetween(null, firstKey);
  } catch (e) {
    // Fallback for corrupted keys
    console.warn('Fallback position generation (start):', e);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `A0${timestamp}${random}`;
  }
};

/**
 * Generate a position key between two existing keys
 * @param beforeKey - The key that should sort before the new key (null for start)
 * @param afterKey - The key that should sort after the new key (null for end)
 * @returns A new key that sorts between beforeKey and afterKey
 */
export const generatePositionBetween = (
  beforeKey: string | null, 
  afterKey: string | null
): string => {
  try {
    return generateKeyBetween(beforeKey, afterKey);
  } catch (e) {
    // Smart fallback strategy
    console.warn('Fallback position generation (between):', e);
    
    if (!beforeKey && !afterKey) {
      // Empty list - return a middle position
      return 'a0';
    }
    
    if (!beforeKey && afterKey) {
      // At start - generate before afterKey
      return generatePositionAtStart(afterKey);
    }
    
    if (beforeKey && !afterKey) {
      // At end - generate after beforeKey
      return generatePositionAtEnd(beforeKey);
    }
    
    // Critical fallback for corrupted data
    // Use timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `m${timestamp}${random}`;
  }
};

/**
 * Validate a position key
 * @param key - The key to validate
 * @returns True if the key is valid
 */
export const isValidPositionKey = (key: unknown): key is string => {
  return typeof key === 'string' && key.length > 0;
};

/**
 * Compare two position keys
 * @param a - First key
 * @param b - Second key
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export const comparePositionKeys = (a: string | null, b: string | null): number => {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a.localeCompare(b);
};

/**
 * Generate multiple sequential position keys
 * @param startKey - Key to start after (null for start of list)
 * @param endKey - Key to end before (null for end of list)
 * @param count - Number of keys to generate
 * @returns Array of position keys
 */
export const generatePositionsBetween = (
  startKey: string | null,
  endKey: string | null,
  count: number
): string[] => {
  const keys: string[] = [];
  let prevKey = startKey;
  
  for (let i = 0; i < count; i++) {
    const nextKey = i === count - 1 ? endKey : null;
    const newKey = generatePositionBetween(prevKey, nextKey);
    keys.push(newKey);
    prevKey = newKey;
  }
  
  return keys;
};

export default {
  generatePositionAtEnd,
  generatePositionAtStart,
  generatePositionBetween,
  isValidPositionKey,
  comparePositionKeys,
  generatePositionsBetween,
};
