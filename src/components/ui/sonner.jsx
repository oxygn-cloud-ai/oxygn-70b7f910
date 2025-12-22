import { useState, useEffect, useRef } from "react"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"
import { AlertCircle, CheckCircle2, Info, AlertTriangle, Loader2, GripVertical } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"

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
const TOAST_POSITION_KEY = 'toast_position';

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

// Default position - computed lazily to avoid SSR issues
const getDefaultPosition = () => ({ x: 16, y: typeof window !== 'undefined' ? window.innerHeight - 100 : 500 });

const useToastPosition = () => {
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 16, y: 500 };
    // Try to get from localStorage first for immediate display
    const cached = localStorage.getItem(TOAST_POSITION_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return getDefaultPosition();
      }
    }
    return getDefaultPosition();
  });
  const [userId, setUserId] = useState(null);
  const saveTimeoutRef = useRef(null);

  // Load position from database on mount
  useEffect(() => {
    const loadPosition = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);
      
      const { data } = await supabase
        .from('q_settings')
        .select('setting_value')
        .eq('setting_key', `toast_position_${user.id}`)
        .single();
      
      if (data?.setting_value) {
        try {
          const pos = JSON.parse(data.setting_value);
          setPosition(pos);
          localStorage.setItem(TOAST_POSITION_KEY, data.setting_value);
        } catch {
          // Keep default
        }
      }
    };
    
    loadPosition();
  }, []);

  const updatePosition = (newPos) => {
    // Clamp to viewport bounds
    const clampedPos = {
      x: Math.max(0, Math.min(newPos.x, window.innerWidth - 400)),
      y: Math.max(0, Math.min(newPos.y, window.innerHeight - 100)),
    };
    
    setPosition(clampedPos);
    localStorage.setItem(TOAST_POSITION_KEY, JSON.stringify(clampedPos));
    
    // Debounce database save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      if (!userId) return;
      
      await supabase
        .from('q_settings')
        .upsert({
          setting_key: `toast_position_${userId}`,
          setting_value: JSON.stringify(clampedPos),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'setting_key' });
    }, 500);
  };

  return { position, updatePosition };
};

const Toaster = ({ ...props }) => {
  const theme = useThemePreference();
  const { position, updatePosition } = useToastPosition();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) {
      e.preventDefault();
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    updatePosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999]"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Drag handle */}
      <div 
        className="drag-handle absolute -top-6 left-0 right-0 flex justify-center opacity-0 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        style={{ opacity: isDragging ? 1 : undefined }}
      >
        <div className="bg-muted/80 backdrop-blur-sm rounded-t-md px-3 py-1 flex items-center gap-1 text-xs text-muted-foreground border border-b-0 border-border">
          <GripVertical className="h-3 w-3" />
          <span>Drag</span>
        </div>
      </div>
      
      <Sonner
        theme={theme}
        position="top-left"
        className="toaster group !static !transform-none"
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
    </div>
  );
};

export { Toaster }
