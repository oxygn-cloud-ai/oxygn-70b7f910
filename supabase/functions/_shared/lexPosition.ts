/**
 * Lexicographic Position Utilities for Deno Edge Functions
 * 
 * Vendored implementation of fractional-indexing for Deno compatibility.
 * Generates string-based positions that sort correctly lexicographically.
 */

const BASE_62_DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SMALLEST_INTEGER = 'A00000000000000000000000000';
const INTEGER_ZERO = 'a0';

function getIntegerLength(head: string): number {
  if (head >= 'a' && head <= 'z') {
    return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
  } else if (head >= 'A' && head <= 'Z') {
    return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
  } else {
    throw new Error('Invalid order key head: ' + head);
  }
}

function getIntegerPart(key: string): string {
  const integerPartLength = getIntegerLength(key.charAt(0));
  if (integerPartLength > key.length) {
    throw new Error('Invalid order key: ' + key);
  }
  return key.slice(0, integerPartLength);
}

function validateOrderKey(key: string): void {
  if (key === SMALLEST_INTEGER) {
    throw new Error('Invalid order key: ' + key);
  }
  const i = getIntegerPart(key);
  const f = key.slice(i.length);
  if (f.slice(-1) === '0') {
    throw new Error('Invalid order key: ' + key);
  }
}

function incrementInteger(x: string): string | null {
  const head = x.charAt(0);
  let digs = x.slice(1);
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i--) {
    const d = BASE_62_DIGITS.indexOf(digs.charAt(i)) + 1;
    if (d === 62) {
      digs = digs.slice(0, i) + '0' + digs.slice(i + 1);
    } else {
      digs = digs.slice(0, i) + BASE_62_DIGITS.charAt(d) + digs.slice(i + 1);
      carry = false;
    }
  }
  if (carry) {
    if (head === 'Z') {
      return 'a0';
    }
    if (head === 'z') {
      return null;
    }
    const h = String.fromCharCode(head.charCodeAt(0) + 1);
    if (h > 'a') {
      digs = digs + '0';
    } else {
      digs = digs.slice(1);
    }
    return h + digs;
  } else {
    return head + digs;
  }
}

function decrementInteger(x: string): string | null {
  const head = x.charAt(0);
  let digs = x.slice(1);
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i--) {
    const d = BASE_62_DIGITS.indexOf(digs.charAt(i)) - 1;
    if (d === -1) {
      digs = digs.slice(0, i) + BASE_62_DIGITS.charAt(61) + digs.slice(i + 1);
    } else {
      digs = digs.slice(0, i) + BASE_62_DIGITS.charAt(d) + digs.slice(i + 1);
      borrow = false;
    }
  }
  if (borrow) {
    if (head === 'a') {
      return 'Z' + BASE_62_DIGITS.charAt(61);
    }
    if (head === 'A') {
      return null;
    }
    const h = String.fromCharCode(head.charCodeAt(0) - 1);
    if (h < 'Z') {
      digs = digs + BASE_62_DIGITS.charAt(61);
    } else {
      digs = digs.slice(1);
    }
    return h + digs;
  } else {
    return head + digs;
  }
}

function midpoint(a: string, b: string | undefined): string {
  if (b !== undefined && a >= b) {
    throw new Error(a + ' >= ' + b);
  }
  if (a.slice(-1) === '0' || (b !== undefined && b.slice(-1) === '0')) {
    throw new Error('Trailing zeros not allowed');
  }
  if (b !== undefined) {
    let n = 0;
    while ((a.charAt(n) || '0') === b.charAt(n)) {
      n++;
    }
    if (n > 0) {
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
    }
  }
  const digitA = a !== '' ? BASE_62_DIGITS.indexOf(a.charAt(0)) : 0;
  const digitB = b !== undefined ? BASE_62_DIGITS.indexOf(b.charAt(0)) : 62;
  if (digitB - digitA > 1) {
    const midDigit = Math.round(0.5 * (digitA + digitB));
    return BASE_62_DIGITS.charAt(midDigit);
  } else {
    if (b !== undefined && b.length > 1) {
      return b.slice(0, 1);
    } else {
      return BASE_62_DIGITS.charAt(digitA) + midpoint(a.slice(1), undefined);
    }
  }
}

/**
 * Generate a key between a and b.
 * @param a - The lower bound (or null for start)
 * @param b - The upper bound (or null for end)
 * @returns A key that sorts between a and b
 */
export function generateKeyBetween(a: string | null, b: string | null): string {
  if (a !== null) {
    validateOrderKey(a);
  }
  if (b !== null) {
    validateOrderKey(b);
  }
  if (a !== null && b !== null && a >= b) {
    throw new Error(a + ' >= ' + b);
  }
  if (a === null) {
    if (b === null) {
      return INTEGER_ZERO;
    }
    const ib = getIntegerPart(b);
    const fb = b.slice(ib.length);
    if (ib === SMALLEST_INTEGER) {
      return ib + midpoint('', fb);
    }
    if (ib < b) {
      return ib;
    }
    const res = decrementInteger(ib);
    if (res === null) {
      throw new Error('Cannot decrement ' + ib);
    }
    return res;
  }
  if (b === null) {
    const ia = getIntegerPart(a);
    const fa = a.slice(ia.length);
    const i = incrementInteger(ia);
    if (i === null) {
      return ia + midpoint(fa, undefined);
    }
    return i;
  }
  const ia = getIntegerPart(a);
  const fa = a.slice(ia.length);
  const ib = getIntegerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) {
    return ia + midpoint(fa, fb);
  }
  const i = incrementInteger(ia);
  if (i === null) {
    throw new Error('Cannot increment ' + ia);
  }
  if (i < b) {
    return i;
  }
  return ia + midpoint(fa, undefined);
}

/**
 * Generate a position key at the END of a list
 */
export const generatePositionAtEnd = (lastKey: string | null): string => {
  try {
    return generateKeyBetween(lastKey, null);
  } catch (e) {
    console.error('[lexPosition] generatePositionAtEnd failed:', { lastKey, error: (e as Error).message });
    // Fallback: generate a timestamp-based key that will sort at the end
    return `z${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
  }
};

/**
 * Generate a position key at the START of a list
 */
export const generatePositionAtStart = (firstKey: string | null): string => {
  try {
    return generateKeyBetween(null, firstKey);
  } catch (e) {
    console.error('[lexPosition] generatePositionAtStart failed:', { firstKey, error: (e as Error).message });
    // Fallback: Use 'A0' prefix - matches fractional-indexing's smallest integer format
    return `A0${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
  }
};

/**
 * Generate a position key BETWEEN two existing keys
 */
export const generatePositionBetween = (beforeKey: string | null, afterKey: string | null): string => {
  try {
    return generateKeyBetween(beforeKey, afterKey);
  } catch (e) {
    console.error('[lexPosition] generatePositionBetween failed:', { beforeKey, afterKey, error: (e as Error).message });
    
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
