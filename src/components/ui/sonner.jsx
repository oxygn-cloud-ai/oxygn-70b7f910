import { useState, useEffect } from "react"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"
import { AlertCircle, CheckCircle2, Info, AlertTriangle, Loader2 } from "lucide-react"

// Toast history callback - set by ToastHistoryConnector
let toastHistoryCallback = null;

export const setToastHistoryCallback = (callback) => {
  toastHistoryCallback = callback;
};

// Wrapped toast functions that record to history
const createWrappedToast = () => {
  const recordToHistory = (variant, message, options) => {
    if (!toastHistoryCallback) return;
    toastHistoryCallback({
      id: Date.now().toString(),
      title: typeof message === "string" ? message : options?.title,
      description: options?.description,
      variant,
      // Pass through technical data for notification history
      details: options?.details || null,
      errorCode: options?.errorCode || null,
      source: options?.source || null,
    });
  };

  return Object.assign(
    (message, options) => {
      recordToHistory("default", message, options);
      return sonnerToast(message, options);
    },
    {
      success: (message, options) => {
        recordToHistory("success", message, options);
        return sonnerToast.success(message, options);
      },
      error: (message, options) => {
        recordToHistory("destructive", message, options);
        return sonnerToast.error(message, options);
      },
      info: (message, options) => {
        recordToHistory("default", message, options);
        return sonnerToast.info(message, options);
      },
      warning: (message, options) => {
        recordToHistory("warning", message, options);
        return sonnerToast.warning(message, options);
      },
      loading: (message, options) => {
        recordToHistory("default", message, options);
        return sonnerToast.loading(message, options);
      },
      promise: sonnerToast.promise,
      dismiss: sonnerToast.dismiss,
      custom: sonnerToast.custom,
      message: sonnerToast.message,
    }
  );
};

export const toast = createWrappedToast();

// Theme preference management
const THEME_STORAGE_KEY = 'theme_preference';

const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getStoredPreference = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(THEME_STORAGE_KEY);
};

export const setThemePreference = (preference) => {
  if (preference === 'system') {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  }
  window.dispatchEvent(new CustomEvent('theme-preference-change'));
};

export const getThemePreference = () => {
  const stored = getStoredPreference();
  return stored || 'system';
};

const useThemePreference = () => {
  const [theme, setTheme] = useState(() => {
    const stored = getStoredPreference();
    return stored || getSystemTheme();
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e) => {
      if (!getStoredPreference()) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    
    const handlePreferenceChange = () => {
      const stored = getStoredPreference();
      setTheme(stored || getSystemTheme());
    };
    
    mediaQuery.addEventListener('change', handleSystemChange);
    window.addEventListener('theme-preference-change', handlePreferenceChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
      window.removeEventListener('theme-preference-change', handlePreferenceChange);
    };
  }, []);

  return theme;
};

const Toaster = ({ ...props }) => {
  const theme = useThemePreference();

  return (
    <Sonner
      theme={theme}
      position="bottom-left"
      className="toaster group"
      closeButton={false}
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        error: <AlertCircle className="h-4 w-4 text-destructive" />,
        warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        info: <Info className="h-4 w-4 text-primary" />,
        loading: <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-warm-lg group-[.toaster]:rounded-lg group-[.toaster]:py-3 group-[.toaster]:px-4",
          title: "group-[.toast]:text-sm group-[.toast]:font-medium",
          description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground group-[.toast]:mt-0.5",
          icon: "group-[.toast]:mr-2.5",
          error: "group-[.toaster]:border-destructive/30 group-[.toaster]:bg-destructive/5",
          success: "group-[.toaster]:border-emerald-500/30 group-[.toaster]:bg-emerald-500/5",
          warning: "group-[.toaster]:border-amber-500/30 group-[.toaster]:bg-amber-500/5",
          info: "group-[.toaster]:border-primary/30 group-[.toaster]:bg-primary/5",
        },
      }}
      {...props}
    />
  );
};

export { Toaster }
