'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getApiConnectionStatus,
  SERVER_DISCONNECTED_MESSAGE,
  SERVER_RECONNECTED_MESSAGE,
  subscribeApiStatus,
  type ApiConnectionStatus,
} from '@/lib/apiStatus';

type ToastVariant = 'info' | 'success' | 'warning';

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  info: 0, // persistent while reconnecting
  success: 3500,
  warning: 5000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const dismissTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const dismissToast = useCallback((id: number) => {
    const timer = dismissTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      dismissTimers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = ++nextId.current;
      setToasts((prev) => {
        // Replace duplicate reconnecting toasts
        const filtered =
          variant === 'info' &&
          message === SERVER_DISCONNECTED_MESSAGE
            ? prev.filter((t) => t.message !== SERVER_DISCONNECTED_MESSAGE)
            : prev;
        return [...filtered, { id, message, variant }];
      });

      const ms = AUTO_DISMISS_MS[variant];
      if (ms > 0) {
        const timer = setTimeout(() => dismissToast(id), ms);
        dismissTimers.current.set(id, timer);
      }
    },
    [dismissToast]
  );

  // Global API status → toast notifications
  useEffect(() => {
    return subscribeApiStatus((status: ApiConnectionStatus, previous) => {
      if (status === 'reconnecting') {
        showToast(SERVER_DISCONNECTED_MESSAGE, 'info');
      } else if (status === 'online' && previous !== 'online') {
        setToasts((prev) =>
          prev.filter((t) => t.message !== SERVER_DISCONNECTED_MESSAGE)
        );
        showToast(SERVER_RECONNECTED_MESSAGE, 'success');
      } else if (status === 'offline') {
        showToast(SERVER_DISCONNECTED_MESSAGE, 'info');
      }
    });
  }, [showToast]);

  // Clear reconnecting toast once back online
  useEffect(() => {
    if (getApiConnectionStatus() === 'online') {
      setToasts((prev) =>
        prev.filter((t) => t.message !== SERVER_DISCONNECTED_MESSAGE)
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of dismissTimers.current.values()) {
        clearTimeout(timer);
      }
      dismissTimers.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.variant}`}
            role="status"
          >
            {toast.variant === 'info' &&
            toast.message === SERVER_DISCONNECTED_MESSAGE ? (
              <span className="toast-spinner" aria-hidden />
            ) : null}
            <span className="toast-message">{toast.message}</span>
            {toast.variant !== 'info' ? (
              <button
                type="button"
                className="toast-dismiss"
                aria-label="Dismiss"
                onClick={() => dismissToast(toast.id)}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
