// @ts-nocheck
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';

interface UndoAction {
  id: string;
  type: string;
  itemName?: string;
  timestamp: number;
  [key: string]: unknown;
}

interface UndoContextValue {
  undoStack: UndoAction[];
  pushUndo: (action: Omit<UndoAction, 'timestamp'>) => void;
  popUndo: () => void;
  peekUndo: () => UndoAction | null;
  clearUndo: (actionId: string) => void;
  clearAllUndo: () => void;
  hasUndo: boolean;
  retentionMinutes: number;
  updateRetention: (minutes: number | string) => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

const DEFAULT_RETENTION_MINUTES = 30;

export const useUndo = () => {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
};

export const UndoProvider = ({ children }: { children: ReactNode }) => {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [retentionMinutes, setRetentionMinutes] = useState(DEFAULT_RETENTION_MINUTES);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    cleanupIntervalRef.current = setInterval(cleanupExpired, 60 * 1000);
    cleanupExpired();
    
    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [cleanupExpired]);

  const pushUndo = useCallback((action: Omit<UndoAction, 'timestamp'>) => {
    setUndoStack(prev => [...prev, { ...action, timestamp: Date.now() } as UndoAction]);
  }, []);

  const popUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const peekUndo = useCallback(() => {
    return undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
  }, [undoStack]);

  const clearUndo = useCallback((actionId: string) => {
    setUndoStack(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const clearAllUndo = useCallback(() => {
    setUndoStack([]);
  }, []);

  const updateRetention = useCallback((minutes: number | string) => {
    const value = Math.max(1, Math.min(1440, parseInt(String(minutes)) || DEFAULT_RETENTION_MINUTES));
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
