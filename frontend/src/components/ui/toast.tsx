/*
 * Verified against the installed @radix-ui/react-toast@1.2.23 before this file was written.
 * The package is published, stable at 1.x, not deprecated, and was last released two days before
 * this build, so it is maintained and no substitute primitive was needed. Its exported parts —
 * Provider, Viewport, Root, Title, Description, Action, Close — are all used below, and the
 * Provider's `swipeDirection` plus Root's `duration` give the auto-dismiss and swipe behaviour
 * DESIGN.md asks for without hand-written timers.
 */
import * as RadixToast from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastRecord {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const ICONS: Record<ToastTone, ReactNode> = {
  info: <Info size={16} aria-hidden="true" />,
  success: <CheckCircle2 size={16} aria-hidden="true" />,
  warning: <AlertTriangle size={16} aria-hidden="true" />,
  error: <XCircle size={16} aria-hidden="true" />,
};

const TONE_CLASSES: Record<ToastTone, string> = {
  info: 'text-[var(--fd-status-progress)]',
  success: 'text-[var(--fd-status-done)]',
  warning: 'text-[var(--fd-status-waiting)]',
  error: 'text-[var(--fd-status-danger)]',
};

export const AUTO_DISMISS_MS = 5000;

export function ToastViewportRoot({ children }: { children: ReactNode }) {
  return (
    <RadixToast.Provider swipeDirection="right" duration={AUTO_DISMISS_MS}>
      {children}
      <RadixToast.Viewport
        data-slot="toast-viewport"
        data-print="hide"
        className={cn(
          'fixed z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none',
          'top-4 right-4 left-4 sm:top-auto sm:bottom-4 sm:left-auto',
        )}
      />
    </RadixToast.Provider>
  );
}

export interface ToastItemProps {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const persistent = toast.tone === 'error';

  return (
    <RadixToast.Root
      duration={persistent ? Number.POSITIVE_INFINITY : AUTO_DISMISS_MS}
      type={persistent ? 'foreground' : 'background'}
      onOpenChange={(open) => {
        if (!open) onDismiss(toast.id);
      }}
      className={cn(
        'flex items-start gap-3 rounded-lg border border-[var(--fd-border)]',
        'bg-[var(--fd-surface-1)] p-3 shadow-[var(--fd-shadow-overlay)]',
        'motion-safe:data-[state=open]:animate-[fd-slide-up_var(--fd-duration-slow)_var(--fd-ease-out)]',
      )}
    >
      <span className={cn('mt-0.5 shrink-0', TONE_CLASSES[toast.tone])}>{ICONS[toast.tone]}</span>

      <div className="min-w-0 flex-1">
        <RadixToast.Title className="text-base font-medium text-[var(--fd-text-primary)]">
          {toast.title}
        </RadixToast.Title>
        {toast.description === undefined ? null : (
          <RadixToast.Description className="mt-0.5 text-xs break-words text-[var(--fd-text-secondary)]">
            {toast.description}
          </RadixToast.Description>
        )}
        {toast.actionLabel === undefined || toast.onAction === undefined ? null : (
          <RadixToast.Action
            asChild
            altText={toast.actionLabel}
            onClick={() => {
              toast.onAction?.();
            }}
          >
            <button
              type="button"
              className="mt-2 rounded-sm text-xs font-medium text-[var(--fd-accent)] underline underline-offset-4 hover:text-[var(--fd-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
            >
              {toast.actionLabel}
            </button>
          </RadixToast.Action>
        )}
      </div>

      <RadixToast.Close asChild>
        <button
          type="button"
          aria-label="Dismiss notification"
          className="shrink-0 rounded-sm p-0.5 text-[var(--fd-text-tertiary)] hover:text-[var(--fd-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </RadixToast.Close>
    </RadixToast.Root>
  );
}
