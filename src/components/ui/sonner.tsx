import { useState, useEffect, useRef } from "react"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"
import { AlertCircle, CheckCircle2, Info, AlertTriangle, Loader2, GripVertical } from "lucide-react"
import { notify } from '@/contexts/ToastHistoryContext'

type ToastOptions = {
  description?: string
  [key: string]: unknown
}

// Wrapped toast that adds to notification history without showing popups
const toast = {
  success: (title: string, options: ToastOptions = {}) => {
    notify.success(title, options)
  },
  error: (title: string, options: ToastOptions = {}) => {
    notify.error(title, options)
  },
  info: (title: string, options: ToastOptions = {}) => {
    notify.info(title, options)
  },
  warning: (title: string, options: ToastOptions = {}) => {
    notify.warning(title, options)
  },
  loading: (title: string, options: ToastOptions = {}) => {
    return sonnerToast.loading(title, options)
  },
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
}

export { toast }

// Theme preference management
const THEME_STORAGE_KEY = 'theme_preference'
const TOAST_POSITION_KEY = 'toast_position'

type Theme = 'light' | 'dark'
type ThemePreference = 'light' | 'dark' | 'system'
type Position = { x: number; y: number }

const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'dark'
  }
}

const getStoredPreference = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

export const setThemePreference = (preference: ThemePreference): void => {
  if (typeof window === 'undefined') return
  try {
    if (preference === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY)
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference)
    }
    window.dispatchEvent(new CustomEvent('theme-preference-change'))
  } catch {
    // Ignore localStorage errors
  }
}

export const getThemePreference = (): ThemePreference => {
  const stored = getStoredPreference()
  return (stored as ThemePreference) || 'system'
}

const useThemePreference = (): Theme => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = getStoredPreference()
    return (stored as Theme) || getSystemTheme()
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (!getStoredPreference()) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    
    const handlePreferenceChange = () => {
      const stored = getStoredPreference()
      setTheme((stored as Theme) || getSystemTheme())
    }
    
    mediaQuery.addEventListener('change', handleSystemChange)
    window.addEventListener('theme-preference-change', handlePreferenceChange)
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange)
      window.removeEventListener('theme-preference-change', handlePreferenceChange)
    }
  }, [])

  return theme
}

const getDefaultPosition = (): Position => ({ 
  x: 16, 
  y: typeof window !== 'undefined' ? window.innerHeight - 100 : 500 
})

const useToastPosition = () => {
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window === 'undefined') return { x: 16, y: 500 }
    try {
      const cached = localStorage.getItem(TOAST_POSITION_KEY)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch {
      // Ignore localStorage errors
    }
    return getDefaultPosition()
  })
  const [userId, setUserId] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const loadPosition = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client")
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        setUserId(user.id)
        
        const { data } = await supabase
          .from('q_settings')
          .select('setting_value')
          .eq('setting_key', `toast_position_${user.id}`)
          .maybeSingle()
        
        if (data?.setting_value) {
          try {
            const pos = JSON.parse(data.setting_value)
            setPosition(pos)
            localStorage.setItem(TOAST_POSITION_KEY, data.setting_value)
          } catch {
            // Keep default
          }
        }
      } catch {
        // Supabase not available, use localStorage only
      }
    }
    
    loadPosition()
  }, [])

  const updatePosition = (newPos: Position) => {
    const clampedPos = {
      x: Math.max(0, Math.min(newPos.x, window.innerWidth - 400)),
      y: Math.max(0, Math.min(newPos.y, window.innerHeight - 100)),
    }
    
    setPosition(clampedPos)
    localStorage.setItem(TOAST_POSITION_KEY, JSON.stringify(clampedPos))
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      if (!userId) return
      
      try {
        const { supabase } = await import("@/integrations/supabase/client")
        await supabase
          .from('q_settings')
          .upsert({
            setting_key: `toast_position_${userId}`,
            setting_value: JSON.stringify(clampedPos),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'setting_key' })
      } catch {
        // Supabase not available, localStorage only
      }
    }, 500)
  }

  return { position, updatePosition }
}

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useThemePreference()
  const { position, updatePosition } = useToastPosition()
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      e.preventDefault()
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    }
  }

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        updatePosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        })
      }

      const handleMouseUp = () => {
        setIsDragging(false)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset, updatePosition])

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
  )
}

export { Toaster }
