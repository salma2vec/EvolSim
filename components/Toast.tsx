/**
 * Toast notification system
 * 
 * Replaces browser alerts with styled, dismissible notifications
 */

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration || 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const typeStyles = {
    success: "border-[#4ade80] bg-[#4ade80]/10 text-[#4ade80]",
    error: "border-[var(--signal-collapse)] bg-[var(--signal-collapse)]/10 text-[var(--signal-collapse)]",
    warning: "border-[var(--signal-violation)] bg-[var(--signal-violation)]/10 text-[var(--signal-violation)]",
    info: "border-foreground/40 bg-surface/50 text-foreground",
  };

  return (
    <div
      className={`
        border px-5 py-3 mb-3 font-mono text-xs uppercase tracking-wider
        backdrop-blur-sm transition-all duration-300
        ${typeStyles[toast.type]}
        animate-in slide-in-from-top-2 fade-in
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-4">
        <span>{toast.message}</span>
        <button
          onClick={() => onDismiss(toast.id)}
          className="opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

let toastIdCounter = 0;
const toastListeners: Array<(toast: Toast) => void> = [];

export function showToast(message: string, type: ToastType = "info", duration?: number) {
  const toast: Toast = {
    id: `toast-${toastIdCounter++}`,
    message,
    type,
    duration,
  };
  toastListeners.forEach((listener) => listener(toast));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
    };
    toastListeners.push(listener);
    return () => {
      const index = toastListeners.indexOf(listener);
      if (index > -1) toastListeners.splice(index, 1);
    };
  }, []);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed top-4 right-4 z-[100] max-w-md pointer-events-none"
      aria-live="assertive"
    >
      <div className="pointer-events-auto space-y-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
        ))}
      </div>
    </div>,
    document.body
  );
}

