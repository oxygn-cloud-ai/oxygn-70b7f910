import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastHistoryContext = createContext(null);

// Global notify function - set after provider mounts
let globalNotify = null;

export const notify = {
  success: (title, options = {}) => globalNotify?.('success', title, options),
  error: (title, options = {}) => globalNotify?.('destructive', title, options),
  info: (title, options = {}) => globalNotify?.('default', title, options),
  warning: (title, options = {}) => globalNotify?.('warning', title, options),
};

export function ToastHistoryProvider({ children }) {
  const [history, setHistory] = useState([]);

  const addToHistory = useCallback((variant, title, options = {}) => {
    const entry = {
      id: Date.now().toString(),
      title,
      description: options.description || null,
      variant,
      timestamp: new Date(),
      stackTrace: variant === 'destructive' ? new Error().stack : null,
      details: options.details || null,
      errorCode: options.errorCode || null,
      source: options.source || null,
    };
    setHistory(prev => [entry, ...prev]);
  }, []);

  // Set up global notify function
  useEffect(() => {
    globalNotify = addToHistory;
    return () => { globalNotify = null; };
  }, [addToHistory]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const removeFromHistory = useCallback((index) => {
    setHistory(prev => prev.filter((_, i) => i !== index));
  }, []);

  const exportHistory = useCallback(() => {
    const exportData = history.map(item => ({
      type: item.variant || 'info',
      title: item.title || '',
      description: item.description || '',
      timestamp: item.timestamp.toISOString(),
      details: item.details || null,
      errorCode: item.errorCode || null,
      source: item.source || null,
      stackTrace: item.stackTrace || null,
    }));

    return {
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      notificationCount: history.length,
      notifications: exportData,
    };
  }, [history]);

  const copyToClipboard = useCallback(async (data) => {
    try {
      const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      return false;
    }
  }, []);

  return (
    <ToastHistoryContext.Provider value={{ 
      history, 
      addToHistory, 
      clearHistory, 
      removeFromHistory,
      exportHistory,
      copyToClipboard 
    }}>
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
