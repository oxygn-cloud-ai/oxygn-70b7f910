import { useTheme } from "next-themes"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"

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

const Toaster = ({ ...props }) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
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
      {...props}
    />
  );
};

export { Toaster }
