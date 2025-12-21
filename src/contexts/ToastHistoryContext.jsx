import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastHistoryContext = createContext(null);

export function ToastHistoryProvider({ children }) {
  const [history, setHistory] = useState([]);

  const addToHistory = useCallback((toast) => {
    // Capture additional context when toast is created
    const entry = {
      ...toast,
      timestamp: new Date(),
      // Capture stack trace for errors
      stackTrace: toast.variant === 'destructive' ? new Error().stack : null,
      // Store any additional details passed
      details: toast.details || null,
      errorCode: toast.errorCode || null,
      source: toast.source || null,
    };
    setHistory(prev => [entry, ...prev]);
  }, []);

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
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(text);
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