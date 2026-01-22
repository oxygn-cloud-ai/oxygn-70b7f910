import { useEffect } from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast, setToastHistoryCallback } from "@/components/ui/use-toast"
import { useToastHistory } from "@/contexts/ToastHistoryContext"

export function Toaster() {
  const { toasts } = useToast()
  const { addToHistory } = useToastHistory()

  useEffect(() => {
    setToastHistoryCallback(addToHistory)
    return () => setToastHistoryCallback(null)
  }, [addToHistory])

  return (
    (<ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          (<Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>)
        );
      })}
      <ToastViewport />
    </ToastProvider>)
  );
}
