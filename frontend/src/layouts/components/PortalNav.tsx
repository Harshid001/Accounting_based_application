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
    <ul className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1 lg:gap-1.5">
      {PORTAL_NAV.map((entry) => (
        <li key={entry.to}>
          <NavLink
            to={entry.to}
            end={entry.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'block rounded-md px-3 py-2 text-md transition-colors md:px-2.5 md:py-1 md:text-sm lg:px-3 lg:py-1.5',
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
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="md:hidden">
            <IconButton
              label="Open navigation menu"
              icon={<Menu size={18} aria-hidden="true" />}
              onClick={onOpenDrawer}
            />
          </span>
          <NavLink
            to="/portal"
            className="flex items-center gap-2.5 outline-none rounded-md transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--fd-focus-ring)]"
            title="JV Tax Consultancy - Client Portal"
          >
            <JVLogo size="sm" />
            <span className="font-semibold text-sm text-[var(--fd-text-primary)] tracking-tight whitespace-nowrap">
              <span className="xl:hidden">JV Tax</span>
              <span className="hidden xl:inline">JV Tax Consultancy</span>
            </span>
          </NavLink>
          <span className="hidden lg:block">
            <EntitySwitcher />
          </span>
        </div>

        <nav aria-label="Portal" className="hidden md:block">
          <PortalLinks />
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <LanguageSwitcher compact />
          <ThemeToggle />
          <NotificationBell enabled to="/portal/messages" />
          <AccountMenu profilePath="/portal/profile" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 pb-2.5 sm:px-4 sm:pb-3 lg:hidden">
        <EntitySwitcher className="w-full" selectClassName="flex-1 w-full" />
      </div>
    </header>
  );
}
