import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ items, className }: { items: readonly Crumb[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" data-print="hide" className={cn('mb-2', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--fd-text-tertiary)]">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.to === undefined || last ? (
                <span aria-current={last ? 'page' : undefined} className="truncate">
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="truncate rounded-sm hover:text-[var(--fd-text-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
                >
                  {item.label}
                </Link>
              )}
              {last ? null : <ChevronRight size={12} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
