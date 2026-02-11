import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface NotifyOptions {
  description?: string;
  details?: string | Record<string, unknown>;
  errorCode?: string;
  source?: string;
}

interface HistoryEntry {
  id: string;
  title: string;
  description: string | null;
  variant: string;
  timestamp: Date;
  callStack: string | null;
  details: string | Record<string, unknown> | null;
  errorCode: string | null;
  source: string | null;
}

interface ExportData {
  exportedAt: string;
  appVersion: string;
  notificationCount: number;
  notifications: Array<{
    type: string;
    title: string;
    description: string;
    timestamp: string;
    details: string | Record<string, unknown> | null;
    errorCode: string | null;
    source: string | null;
    callStack: string | null;
  }>;
}

interface ToastHistoryContextValue {
  history: HistoryEntry[];
  addToHistory: (variant: string, title: string, options?: NotifyOptions) => void;
  clearHistory: () => void;
  removeFromHistory: (index: number) => void;
  exportHistory: () => ExportData;
  copyToClipboard: (data: unknown) => Promise<boolean>;
}

const ToastHistoryContext = createContext<ToastHistoryContextValue | null>(null);

// Global notify function - set after provider mounts
let globalNotify: ((variant: string, title: string, options?: NotifyOptions) => void) | null = null;

export const notify = {
  success: (title: string, options: NotifyOptions = {}) => globalNotify?.('success', title, options),
  error: (title: string, options: NotifyOptions = {}) => globalNotify?.('destructive', title, options),
  info: (title: string, options: NotifyOptions = {}) => globalNotify?.('default', title, options),
  warning: (title: string, options: NotifyOptions = {}) => globalNotify?.('warning', title, options),
};

export function ToastHistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const addToHistory = useCallback((variant: string, title: string, options: NotifyOptions = {}) => {
    const rawStack = new Error().stack;
    const callStack = rawStack?.replace(/^Error\n/, '') || null;
    
    const entry: HistoryEntry = {
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

  useEffect(() => {
    globalNotify = addToHistory;
    return () => { globalNotify = null; };
  }, [addToHistory]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const removeFromHistory = useCallback((index: number) => {
    setHistory(prev => prev.filter((_, i) => i !== index));
  }, []);

  const exportHistory = useCallback((): ExportData => {
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

  const copyToClipboard = useCallback(async (data: unknown): Promise<boolean> => {
    try {
      const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
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
