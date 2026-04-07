"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

type ToastTone = "info" | "success" | "warning" | "error";

interface ToastRecord {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  pushToast: (input: {
    tone?: ToastTone;
    title: string;
    description?: string;
    durationMs?: number;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export function ToastProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast: ({
        tone = "info",
        title,
        description,
        durationMs = 3200,
      }) => {
        const id = toastCounter += 1;
        setToasts((current) => [...current, { id, tone, title, description }]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
        }, durationMs);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className={`toast-card tone-${toast.tone}`} key={toast.id} role="status">
            <div className="toast-icon" aria-hidden="true">
              {getToastIcon(toast.tone)}
            </div>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.description ? <p>{toast.description}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}

function getToastIcon(tone: ToastTone) {
  if (tone === "success") {
    return <CheckCircle2 size={16} />;
  }

  if (tone === "warning") {
    return <AlertTriangle size={16} />;
  }

  if (tone === "error") {
    return <XCircle size={16} />;
  }

  return <Info size={16} />;
}
