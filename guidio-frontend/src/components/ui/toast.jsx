"use client";

import * as React from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const ToastColors = {
  success: "bg-success/10 text-success border-success/20 dark:bg-success/20 dark:text-success",
  error: "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-destructive",
  warning: "bg-warning/10 text-warning border-warning/20 dark:bg-warning/20 dark:text-warning",
  info: "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary",
};

/**
 * @typedef {Object} ToastProps
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {"success" | "error" | "warning" | "info"} type
 * @property {(id: string) => void} onClose
 * @property {number} [duration]
 */

export function Toast({ id, title, description, type, onClose, duration = 5000 }) {
  const [isVisible, setIsVisible] = React.useState(true);
  const [isExiting, setIsExiting] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose(id);
      }, 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  if (!isVisible) return null;

  const Icon = ToastIcons[type];

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-[1rem] border p-4 shadow-xl animate-in slide-in-from-right-full duration-300",
        isExiting && "animate-out slide-out-to-right-full duration-200 opacity-0",
        ToastColors[type],
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex shrink-0 items-center justify-center size-5">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        {description && (
          <p className="mt-1 text-sm leading-snug opacity-90">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => {
            setIsVisible(false);
            onClose(id);
          }, 200);
        }}
        className="flex shrink-0 items-center justify-center size-5 rounded-full opacity-50 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        aria-label="Dismiss"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * @typedef {Object} ToastProviderProps
 * @property {React.ReactNode} children
 */

/**
 * @typedef {Object} ToastContextValue
 * @property {(options: Omit<ToastProps, "id" | "onClose">) => string} toast
 * @property {(id: string) => void} dismiss
 */

const ToastContext = React.createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);

  const dismiss = React.useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback((options) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { ...options, id, onClose: dismiss }]);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 sm:bottom-6 sm:right-6"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Convenience hooks
export function useSuccessToast() {
  const { toast } = useToast();
  return React.useCallback(
    (title, description, duration) => toast({ title, description, type: "success", duration }),
    [toast]
  );
}

export function useErrorToast() {
  const { toast } = useToast();
  return React.useCallback(
    (title, description, duration) => toast({ title, description, type: "error", duration }),
    [toast]
  );
}

export function useWarningToast() {
  const { toast } = useToast();
  return React.useCallback(
    (title, description, duration) => toast({ title, description, type: "warning", duration }),
    [toast]
  );
}

export function useInfoToast() {
  const { toast } = useToast();
  return React.useCallback(
    (title, description, duration) => toast({ title, description, type: "info", duration }),
    [toast]
  );
}