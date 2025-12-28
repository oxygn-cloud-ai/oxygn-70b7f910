import { createContext, useContext, useState, useCallback } from 'react';

const UndoContext = createContext(null);

export const useUndo = () => {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
};

export const UndoProvider = ({ children }) => {
  const [undoStack, setUndoStack] = useState([]);

  // Push an action to the undo stack
  const pushUndo = useCallback((action) => {
    setUndoStack(prev => [...prev, { ...action, timestamp: Date.now() }]);
  }, []);

  // Pop the most recent action from the stack
  const popUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  // Get the most recent action without removing it
  const peekUndo = useCallback(() => {
    return undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
  }, [undoStack]);

  // Clear specific action by id
  const clearUndo = useCallback((actionId) => {
    setUndoStack(prev => prev.filter(a => a.id !== actionId));
  }, []);

  // Clear all undo history
  const clearAllUndo = useCallback(() => {
    setUndoStack([]);
  }, []);

  return (
    <UndoContext.Provider value={{
      undoStack,
      pushUndo,
      popUndo,
      peekUndo,
      clearUndo,
      clearAllUndo,
      hasUndo: undoStack.length > 0
    }}>
      {children}
    </UndoContext.Provider>
  );
};
