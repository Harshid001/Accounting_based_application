import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/cn';

export interface RoutedTab {
  to: string;
  label: string;
  badge?: number;
  end?: boolean;
}

export interface RoutedTabsProps {
  tabs: readonly RoutedTab[];
  ariaLabel: string;
  className?: string;
}

export function RoutedTabs({ tabs, ariaLabel, className }: RoutedTabsProps) {
  return (
    <nav
      aria-label={ariaLabel}
      data-print="hide"
      className={cn('border-b border-[var(--fd-border-subtle)]', className)}
    >
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 border-b-2 px-3 py-2 text-base whitespace-nowrap',
                  'transition-colors duration-[var(--fd-duration-fast)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
                  isActive
                    ? 'border-[var(--fd-accent)] font-medium text-[var(--fd-text-primary)]'
                    : 'border-transparent text-[var(--fd-text-secondary)] hover:border-[var(--fd-border-strong)] hover:text-[var(--fd-text-primary)]',
                )
              }
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 ? (
                <span className="numeric text-2xs rounded-full bg-[var(--fd-accent-subtle-bg)] px-1.5 py-0.5 text-[var(--fd-accent)]">
                  {tab.badge}
                </span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
