import {
  Building2,
  CalendarClock,
  CheckSquare,
  FileText,
  Gauge,
  Inbox,
  ListTodo,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Settings,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/cn';
import type { Capability } from '@/lib/permissions';
import { IconButton } from '@/components/ui/icon-button';
import { useSession } from '@/context/SessionContext';

export interface NavEntry {
  to: string;
  label: string;
  icon: ReactNode;
  capability?: Capability;
  end?: boolean;
}

export const STAFF_NAV: NavEntry[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <Gauge size={16} aria-hidden="true" />, end: true },
  { to: '/my-work', label: 'My work', icon: <ListTodo size={16} aria-hidden="true" /> },
  {
    to: '/clients',
    label: 'Clients',
    icon: <Building2 size={16} aria-hidden="true" />,
    capability: 'client:read',
  },
  {
    to: '/compliance',
    label: 'Filings',
    icon: <CalendarClock size={16} aria-hidden="true" />,
    capability: 'compliance:read',
  },
  {
    to: '/tasks',
    label: 'Tasks',
    icon: <CheckSquare size={16} aria-hidden="true" />,
    capability: 'task:read',
  },
  {
    to: '/documents',
    label: 'Documents',
    icon: <FileText size={16} aria-hidden="true" />,
    capability: 'document:read',
  },
  {
    to: '/requests',
    label: 'Requests',
    icon: <Inbox size={16} aria-hidden="true" />,
    capability: 'document_request:read',
  },
  {
    to: '/messages',
    label: 'Messages',
    icon: <MessagesSquare size={16} aria-hidden="true" />,
    capability: 'message:threads',
  },
  {
    to: '/reports/compliance',
    label: 'Reports',
    icon: <PieChart size={16} aria-hidden="true" />,
    capability: 'report:read',
  },
  {
    to: '/settings/firm',
    label: 'Settings',
    icon: <Settings size={16} aria-hidden="true" />,
    capability: 'settings:write',
  },
];

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  variant?: 'fixed' | 'drawer';
}

export function Sidebar({ collapsed, onToggle, onNavigate, variant = 'fixed' }: SidebarProps) {
  const { allows } = useSession();
  const entries = STAFF_NAV.filter(
    (entry) => entry.capability === undefined || allows(entry.capability),
  );
  const isDrawer = variant === 'drawer';
  const narrow = collapsed && !isDrawer;

  return (
    <nav
      aria-label="Main"
      data-slot="sidebar"
      data-print="hide"
      className={cn(
        'flex h-full flex-col border-r border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)]',
        'transition-[width] duration-[var(--fd-duration-base)]',
        narrow ? 'w-[60px]' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-[var(--fd-border-subtle)] px-3',
          narrow ? 'justify-center' : 'justify-between',
        )}
      >
        {narrow ? null : (
          <span className="truncate text-lg font-semibold text-[var(--fd-text-primary)]">
            FirmDesk
          </span>
        )}
        {isDrawer ? null : (
          <IconButton
            label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
            size="sm"
            onClick={onToggle}
            icon={
              collapsed ? (
                <PanelLeftOpen size={15} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={15} aria-hidden="true" />
              )
            }
          />
        )}
      </div>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {entries.map((entry) => (
          <li key={entry.to}>
            <NavLink
              to={entry.to}
              end={entry.end}
              onClick={onNavigate}
              title={narrow ? entry.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-2.5 py-2 text-base transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
                  narrow && 'justify-center px-0',
                  isActive
                    ? 'bg-[var(--fd-accent-subtle-bg)] font-medium text-[var(--fd-accent)]'
                    : 'text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]',
                )
              }
            >
              <span className="shrink-0">{entry.icon}</span>
              {narrow ? <span className="sr-only">{entry.label}</span> : <span>{entry.label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
