import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { normaliseError } from '@/lib/errors';

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
  compact?: boolean;
}

export function ErrorState({ error, onRetry, title, className, compact = false }: ErrorStateProps) {
  const normalised = normaliseError(error);

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <span className="rounded-full bg-[var(--fd-status-danger-bg)] p-3 text-[var(--fd-status-danger)]">
        <AlertTriangle size={20} aria-hidden="true" />
      </span>
      <div className="max-w-md space-y-1">
        <p className="text-lg font-semibold text-[var(--fd-text-primary)]">
          {title ?? 'This did not load'}
        </p>
        <p className="text-base text-[var(--fd-text-secondary)]">{normalised.message}</p>
      </div>
      {onRetry === undefined ? null : (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
      {normalised.requestId === null ? null : (
        <p className="text-2xs font-mono text-[var(--fd-text-tertiary)]">
          Reference {normalised.requestId}
        </p>
      )}
    </div>
  );
}

export function InlineError({ message, requestId }: { message: string; requestId?: string | null }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-[var(--fd-status-danger)] bg-[var(--fd-status-danger-bg)] px-3 py-2"
    >
      <p className="text-base text-[var(--fd-text-primary)]">{message}</p>
      {requestId === null || requestId === undefined ? null : (
        <p className="text-2xs mt-1 font-mono text-[var(--fd-text-tertiary)]">
          Reference {requestId}
        </p>
      )}
    </div>
  );
}
