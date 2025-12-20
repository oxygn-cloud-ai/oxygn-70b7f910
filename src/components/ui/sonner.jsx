import { useTheme } from "next-themes"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"

// Toast history for tracking all notifications
let toastHistoryCallback = null;
let sonnerPatched = false;

export const setToastHistoryCallback = (callback) => {
  toastHistoryCallback = callback;
};

const recordToHistory = (variant, message, options) => {
  if (!toastHistoryCallback) return;

  toastHistoryCallback({
    id: Date.now().toString(),
    title: typeof message === "string" ? message : options?.title,
    description: options?.description,
    variant,
  });
};

// Patch Sonner's exported toast methods so even `import { toast } from 'sonner'`
// gets recorded in our history.
if (!sonnerPatched) {
  sonnerPatched = true;

  const original = {
    success: sonnerToast.success,
    error: sonnerToast.error,
    info: sonnerToast.info,
    warning: sonnerToast.warning,
    loading: sonnerToast.loading,
  };

  sonnerToast.success = (message, options) => {
    recordToHistory("success", message, options);
    return original.success(message, options);
  };

  sonnerToast.error = (message, options) => {
    recordToHistory("destructive", message, options);
    return original.error(message, options);
  };

  sonnerToast.info = (message, options) => {
    recordToHistory("default", message, options);
    return original.info(message, options);
  };

  sonnerToast.warning = (message, options) => {
    recordToHistory("warning", message, options);
    return original.warning(message, options);
  };

  sonnerToast.loading = (message, options) => {
    recordToHistory("default", message, options);
    return original.loading(message, options);
  };
}

// Re-export Sonner's toast (now patched) for internal imports.
export const toast = sonnerToast;


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
