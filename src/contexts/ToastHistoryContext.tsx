import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type ToastVariant = 'success' | 'destructive' | 'default' | 'warning';

export interface ToastEntry {
  id: string;
  title: string;
  description: string | null;
  variant: ToastVariant;
  timestamp: Date;
  callStack: string | null;
  details: string | null;
  errorCode: string | null;
  source: string | null;
}

export interface ToastOptions {
  description?: string;
  details?: string;
  errorCode?: string;
  source?: string;
}

export interface ExportedToast {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  details: string | null;
  errorCode: string | null;
  source: string | null;
  callStack: string | null;
}

export interface ExportedHistory {
  exportedAt: string;
  appVersion: string;
  notificationCount: number;
  notifications: ExportedToast[];
}

export interface ToastHistoryContextValue {
  history: ToastEntry[];
  addToHistory: (variant: ToastVariant, title: string, options?: ToastOptions) => void;
  clearHistory: () => void;
  removeFromHistory: (index: number) => void;
  exportHistory: () => ExportedHistory;
  copyToClipboard: (data: string | object) => Promise<boolean>;
}

const ToastHistoryContext = createContext<ToastHistoryContextValue | null>(null);

// Global notify function - set after provider mounts
type GlobalNotifyFn = (variant: ToastVariant, title: string, options?: ToastOptions) => void;
let globalNotify: GlobalNotifyFn | null = null;

export const notify = {
  success: (title: string, options: ToastOptions = {}): void => {
    globalNotify?.('success', title, options);
  },
  error: (title: string, options: ToastOptions = {}): void => {
    globalNotify?.('destructive', title, options);
  },
  info: (title: string, options: ToastOptions = {}): void => {
    globalNotify?.('default', title, options);
  },
  warning: (title: string, options: ToastOptions = {}): void => {
    globalNotify?.('warning', title, options);
  },
};

interface ToastHistoryProviderProps {
  children: ReactNode;
}

export function ToastHistoryProvider({ children }: ToastHistoryProviderProps) {
  const [history, setHistory] = useState<ToastEntry[]>([]);

  const addToHistory = useCallback((variant: ToastVariant, title: string, options: ToastOptions = {}): void => {
    // Capture call stack for debugging - strip "Error\n" prefix for cleaner display
    const rawStack = new Error().stack;
    const callStack = rawStack?.replace(/^Error\n/, '') || null;
    
    const entry: ToastEntry = {
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

  const clearHistory = useCallback((): void => {
    setHistory([]);
  }, []);

  const removeFromHistory = useCallback((index: number): void => {
    setHistory(prev => prev.filter((_, i) => i !== index));
  }, []);

  const exportHistory = useCallback((): ExportedHistory => {
    const exportData: ExportedToast[] = history.map(item => ({
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

  const copyToClipboard = useCallback(async (data: string | object): Promise<boolean> => {
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

export function useToastHistory(): ToastHistoryContextValue {
  const context = useContext(ToastHistoryContext);
  if (!context) {
    throw new Error('useToastHistory must be used within a ToastHistoryProvider');
  }
  return context;
}
