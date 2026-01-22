import { createContext, useContext, useState, useCallback, useEffect } from 'react';

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
    // Capture call stack for debugging - strip "Error\n" prefix for cleaner display
    const rawStack = new Error().stack;
    const callStack = rawStack?.replace(/^Error\n/, '') || null;
    
    const entry = {
      id: Date.now().toString(),
      title,
      description: options.description || null,
      variant,
      timestamp: new Date(),
      callStack,
      details: options.details || null,
      errorCode: options.errorCode || null,
      source: options.source || null,
    };
    
    // Log to console for debugging - include full context
    const logLevel = variant === 'destructive' ? 'error' : variant === 'warning' ? 'warn' : 'info';
    console[logLevel](`[Toast/${variant}] ${title}`, {
      description: options.description,
      details: options.details,
      source: options.source,
      errorCode: options.errorCode,
      callStack,
    });
    
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
      callStack: item.callStack || null,
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
