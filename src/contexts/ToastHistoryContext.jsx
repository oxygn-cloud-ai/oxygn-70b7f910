import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastHistoryContext = createContext(null);

const MAX_HISTORY = 50;

export function ToastHistoryProvider({ children }) {
  const [history, setHistory] = useState([]);

  const addToHistory = useCallback((toast) => {
    const entry = {
      ...toast,
      timestamp: new Date(),
    };
    setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return (
    <ToastHistoryContext.Provider value={{ history, addToHistory, clearHistory }}>
      {children}
    </ToastHistoryContext.Provider>
  );
}

export function useToastHistory() {
  const context = useContext(ToastHistoryContext);
  if (!context) {
    throw new Error('useToastHistory must be used within a ToastHistoryProvider');
  }
  return context;
}
