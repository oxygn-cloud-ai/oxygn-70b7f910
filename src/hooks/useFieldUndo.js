import { useState, useRef, useCallback, useEffect } from 'react';

const MAX_UNDO_STACK = 10;

/**
 * useFieldUndo - Field-level undo/discard state management
 * 
 * Tracks previous saved values for undo (max 10 entries)
 * and original value when field first loaded for discard.
 */
export const useFieldUndo = (initialValue) => {
  const [undoStack, setUndoStack] = useState([]);
  const originalValueRef = useRef(initialValue);
  
  // Update original value when prop changes externally
  useEffect(() => {
    originalValueRef.current = initialValue;
    // Clear undo stack when external value changes
    setUndoStack([]);
  }, [initialValue]);
  
  // Push a value onto the undo stack (call before saving new value)
  const pushPreviousValue = useCallback((value) => {
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
  const popPreviousValue = useCallback(() => {
    if (undoStack.length === 0) return null;
    
    const lastValue = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    return lastValue;
  }, [undoStack]);
  
  // Get the original value (for discard)
  const getOriginalValue = useCallback(() => {
    return originalValueRef.current;
  }, []);
  
  // Check if undo is available
  const hasPreviousValue = undoStack.length > 0;
  
  // Check if current value differs from original
  const hasChangedFromOriginal = useCallback((currentValue) => {
    const original = originalValueRef.current || '';
    const current = currentValue || '';
    return current !== original;
  }, []);
  
  // Clear the undo stack
  const clearUndoStack = useCallback(() => {
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
