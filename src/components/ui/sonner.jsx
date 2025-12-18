import { useTheme } from "next-themes"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"

// Toast history for tracking all notifications
let toastHistoryCallback = null;

export const setToastHistoryCallback = (callback) => {
  toastHistoryCallback = callback;
};

// Wrapped toast function that also records to history
export const toast = Object.assign(
  (message, options) => {
    if (toastHistoryCallback) {
      toastHistoryCallback({
        id: Date.now().toString(),
        title: typeof message === 'string' ? message : options?.title,
        description: options?.description,
        variant: options?.variant || 'default',
      });
    }
    return sonnerToast(message, options);
  },
  {
    success: (message, options) => {
      if (toastHistoryCallback) {
        toastHistoryCallback({
          id: Date.now().toString(),
          title: typeof message === 'string' ? message : options?.title,
          description: options?.description,
          variant: 'success',
        });
      }
      return sonnerToast.success(message, options);
    },
    error: (message, options) => {
      if (toastHistoryCallback) {
        toastHistoryCallback({
          id: Date.now().toString(),
          title: typeof message === 'string' ? message : options?.title,
          description: options?.description,
          variant: 'destructive',
        });
      }
      return sonnerToast.error(message, options);
    },
    info: (message, options) => {
      if (toastHistoryCallback) {
        toastHistoryCallback({
          id: Date.now().toString(),
          title: typeof message === 'string' ? message : options?.title,
          description: options?.description,
          variant: 'default',
        });
      }
      return sonnerToast.info(message, options);
    },
    warning: (message, options) => {
      if (toastHistoryCallback) {
        toastHistoryCallback({
          id: Date.now().toString(),
          title: typeof message === 'string' ? message : options?.title,
          description: options?.description,
          variant: 'warning',
        });
      }
      return sonnerToast.warning(message, options);
    },
    promise: sonnerToast.promise,
    dismiss: sonnerToast.dismiss,
    loading: sonnerToast.loading,
  }
);

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    (<Sonner
      theme={theme}
      position="bottom-left"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props} />)
  );
}

export { Toaster }
