import { useState, useRef, useCallback, useEffect } from 'react';

const MAX_UNDO_STACK = 10;

interface UseFieldUndoReturn {
  pushPreviousValue: (value: string) => void;
  popPreviousValue: () => string | null;
  getOriginalValue: () => string;
  hasPreviousValue: boolean;
  hasChangedFromOriginal: (currentValue: string) => boolean;
  clearUndoStack: () => void;
}

/**
 * useFieldUndo - Field-level undo/discard state management
 * 
 * Tracks previous saved values for undo (max 10 entries)
 * and original value when field first loaded for discard.
 * 
 * @param initialValue - The initial value from the parent prop
 * @param entityId - Optional unique identifier for the entity (e.g., promptId).
 *                   When entityId changes, undo stack is fully reset.
 *                   When only initialValue changes (same entity), undo stack is preserved.
 */
export const useFieldUndo = (
  initialValue: string, 
  entityId: string | null = null
): UseFieldUndoReturn => {
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const originalValueRef = useRef<string>(initialValue);
  const prevEntityIdRef = useRef<string | null>(entityId);
  const prevInitialValueRef = useRef<string>(initialValue);
  
  useEffect(() => {
    // When entity changes (different prompt selected), fully reset
    if (entityId !== null && prevEntityIdRef.current !== entityId) {
      originalValueRef.current = initialValue;
      setUndoStack([]);
      prevEntityIdRef.current = entityId;
      prevInitialValueRef.current = initialValue;
    }
    // When initialValue changes but entity is same (e.g., after save), 
    // just update original for discard but PRESERVE the undo stack
    else if (prevInitialValueRef.current !== initialValue) {
      originalValueRef.current = initialValue;
      // DO NOT clear undo stack here - it should persist across saves
      prevInitialValueRef.current = initialValue;
    }
  }, [initialValue, entityId]);
  
  // Push a value onto the undo stack (call before saving new value)
  const pushPreviousValue = useCallback((value: string): void => {
    if (value === undefined || value === null) return;
    
    setUndoStack(prev => {
      // Don't push duplicate of top value
      if (prev.length > 0 && prev[prev.length - 1] === value) {
        return prev;
      }
      const newStack = [...prev, value];
      // Keep max size
      if (newStack.length > MAX_UNDO_STACK) {
        return newStack.slice(-MAX_UNDO_STACK);
      }
      return newStack;
    });
  }, []);
  
  // Pop and return the last saved value (for undo)
  const popPreviousValue = useCallback((): string | null => {
    if (undoStack.length === 0) return null;
    
    const lastValue = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    return lastValue;
  }, [undoStack]);
  
  // Get the original value (for discard)
  const getOriginalValue = useCallback((): string => {
    return originalValueRef.current;
  }, []);
  
  // Check if undo is available
  const hasPreviousValue = undoStack.length > 0;
  
  // Check if current value differs from original
  const hasChangedFromOriginal = useCallback((currentValue: string): boolean => {
    const original = originalValueRef.current || '';
    const current = currentValue || '';
    return current !== original;
  }, []);
  
  // Clear the undo stack
  const clearUndoStack = useCallback((): void => {
    setUndoStack([]);
  }, []);
  
  return {
    pushPreviousValue,
    popPreviousValue,
    getOriginalValue,
    hasPreviousValue,
    hasChangedFromOriginal,
    clearUndoStack,
  };
};

export default useFieldUndo;
