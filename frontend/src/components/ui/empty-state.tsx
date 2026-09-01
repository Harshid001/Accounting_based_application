import type { ReactNode } from 'react';
import { FilterX, Inbox } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="rounded-full bg-[var(--fd-surface-2)] p-3 text-[var(--fd-text-tertiary)]">
        {icon ?? <Inbox size={20} aria-hidden="true" />}
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-lg font-semibold text-[var(--fd-text-primary)]">{title}</p>
        <p className="text-base text-[var(--fd-text-secondary)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export interface FilteredEmptyStateProps {
  activeFilters: readonly string[];
  onClear: () => void;
  className?: string;
}

export function FilteredEmptyState({
  activeFilters,
  onClear,
  className,
}: FilteredEmptyStateProps) {
  return (
    <EmptyState
      className={className}
      icon={<FilterX size={20} aria-hidden="true" />}
      title="Nothing matches these filters"
      description={
        activeFilters.length > 0
          ? `Active filters: ${activeFilters.join(', ')}. Widen or clear them to see more.`
          : 'Widen your search to see more.'
      }
      action={
        <Button variant="secondary" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      }
    />
  );
}
