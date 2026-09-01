import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { ToastItem, ToastViewportRoot } from '@/components/ui/toast';
import type { ToastRecord, ToastTone } from '@/components/ui/toast';
import { normaliseError } from '@/lib/errors';

export interface ToastInput {
  tone?: ToastTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  success: (title: string, description?: string) => void;
  errorToast: (error: unknown, title?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;
const nextId = (): string => {
  counter += 1;
  return `toast-${counter}`;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const record: ToastRecord = {
      id: nextId(),
      tone: input.tone ?? 'info',
      title: input.title,
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.actionLabel === undefined ? {} : { actionLabel: input.actionLabel }),
      ...(input.onAction === undefined ? {} : { onAction: input.onAction }),
    };
    setToasts((current) => [...current.slice(-4), record]);
  }, []);

  const success = useCallback(
    (title: string, description?: string) => {
      toast({ tone: 'success', title, ...(description === undefined ? {} : { description }) });
    },
    [toast],
  );

  const errorToast = useCallback(
    (error: unknown, title?: string) => {
      const normalised = normaliseError(error);
      const description =
        normalised.requestId === null
          ? normalised.message
          : `${normalised.message} (reference ${normalised.requestId})`;
      toast({ tone: 'error', title: title ?? 'That did not work', description });
    },
    [toast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toast, success, errorToast, dismiss }),
    [toast, success, errorToast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      <ToastViewportRoot>
        {children}
        {toasts.map((record) => (
          <ToastItem key={record.id} toast={record} onDismiss={dismiss} />
        ))}
      </ToastViewportRoot>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (value === null) throw new Error('useToast must be used inside ToastProvider.');
  return value;
}
