import { Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/cn';
import { AccountMenu } from '@/layouts/components/AccountMenu';
import { EntitySwitcher } from '@/components/domain/EntitySwitcher';
import { IconButton } from '@/components/ui/icon-button';
import { NotificationBell } from '@/components/domain/NotificationBell';
import { ThemeToggle } from '@/components/domain/ThemeToggle';
import { LanguageSwitcher } from '@/components/domain/LanguageSwitcher';
import { JVLogo } from '@/components/brand/JVLogo';

export interface PortalNavEntry {
  to: string;
  label: string;
  end?: boolean;
}

export const PORTAL_NAV: readonly PortalNavEntry[] = [
  { to: '/portal', label: 'Overview', end: true },
  { to: '/portal/compliance', label: 'Filings' },
  { to: '/portal/requests', label: 'Requests' },
  { to: '/portal/documents', label: 'Documents' },
  { to: '/portal/tasks', label: 'Tasks' },
  { to: '/portal/messages', label: 'Messages' },
  { to: '/portal/profile', label: 'Profile' },
];

export function PortalLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1 md:flex-row md:items-center">
      {PORTAL_NAV.map((entry) => (
        <li key={entry.to}>
          <NavLink
            to={entry.to}
            end={entry.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'block rounded-md px-3 py-2 text-md transition-colors md:py-1.5 md:text-base',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
                isActive
                  ? 'bg-[var(--fd-accent-subtle-bg)] font-medium text-[var(--fd-accent)]'
                  : 'text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]',
              )
            }
          >
            {entry.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function PortalNav({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <header
      data-slot="portal-nav"
      data-print="hide"
      className="border-b border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)]"
    >
      <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <IconButton
            label="Open navigation menu"
            icon={<Menu size={18} aria-hidden="true" />}
            onClick={onOpenDrawer}
          />
          <span className="flex items-center gap-2 shrink-0">
            <JVLogo size="sm" />
            <span className="hidden sm:block truncate text-sm font-semibold text-[var(--fd-text-primary)] tracking-tight">JV Tax Consultancy</span>
          </span>
          <span className="hidden md:block">
            <EntitySwitcher />
          </span>
        </div>

        <nav aria-label="Portal" className="hidden md:block">
          <PortalLinks />
        </nav>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <LanguageSwitcher compact />
          <ThemeToggle />
          <NotificationBell enabled to="/portal/messages" />
          <AccountMenu profilePath="/portal/profile" />
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-3 pb-2.5 sm:px-4 sm:pb-3 md:hidden">
        <EntitySwitcher className="w-full" selectClassName="flex-1 w-full" />
      </div>
    </header>
  );
}
