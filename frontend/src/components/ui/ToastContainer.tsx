'use client';

import { useToastStore, ToastType } from '@/stores/useToastStore';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const toastStyles: Record<ToastType, { bg: string; border: string; icon: typeof CheckCircle }> = {
  success: { bg: 'var(--success)', border: 'var(--success)', icon: CheckCircle },
  error: { bg: 'var(--error)', border: 'var(--error)', icon: AlertCircle },
  warning: { bg: 'var(--warning)', border: 'var(--warning)', icon: AlertTriangle },
  info: { bg: 'var(--primary)', border: 'var(--primary)', icon: Info },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const style = toastStyles[toast.type];
        const Icon = style.icon;

        return (
          <div
            key={toast.id}
            className="flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right-5"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: style.border,
              color: 'var(--foreground)',
            }}
          >
            <Icon
              size={18}
              className="flex-shrink-0 mt-0.5"
              style={{ color: style.bg }}
            />
            <p className="text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
