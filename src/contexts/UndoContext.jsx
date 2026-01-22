import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const UndoContext = createContext(null);

// Default retention period in minutes
const DEFAULT_RETENTION_MINUTES = 30;

export const useUndo = () => {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
};

export const UndoProvider = ({ children }) => {
  const [undoStack, setUndoStack] = useState([]);
  const [retentionMinutes, setRetentionMinutes] = useState(DEFAULT_RETENTION_MINUTES);
  const cleanupIntervalRef = useRef(null);

  // Cleanup expired entries
  const cleanupExpired = useCallback(() => {
    const now = Date.now();
    const retentionMs = retentionMinutes * 60 * 1000;
    
    setUndoStack(prev => {
      const filtered = prev.filter(action => {
        const age = now - action.timestamp;
        return age < retentionMs;
      });
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [retentionMinutes]);

  // Set up cleanup interval
  useEffect(() => {
    // Run cleanup every minute
    cleanupIntervalRef.current = setInterval(cleanupExpired, 60 * 1000);
    
    // Also run immediately when retention changes
    cleanupExpired();
    
    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [cleanupExpired]);

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

  // Update retention period (in minutes)
  const updateRetention = useCallback((minutes) => {
    const value = Math.max(1, Math.min(1440, parseInt(minutes) || DEFAULT_RETENTION_MINUTES));
    setRetentionMinutes(value);
  }, []);

  return (
    <UndoContext.Provider value={{
      undoStack,
      pushUndo,
      popUndo,
      peekUndo,
      clearUndo,
      clearAllUndo,
      hasUndo: undoStack.length > 0,
      retentionMinutes,
      updateRetention
    }}>
      {children}
    </UndoContext.Provider>
  );
};
