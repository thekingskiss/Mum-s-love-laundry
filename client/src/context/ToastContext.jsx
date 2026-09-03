import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
const AUTO_DISMISS_MS = 4000;

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, variant) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
    }),
    [push]
  );

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.toast;
}

// Internal — only ToastContainer needs the raw list + dismiss.
export function useToastState() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastState must be used within a ToastProvider');
  return ctx;
}
