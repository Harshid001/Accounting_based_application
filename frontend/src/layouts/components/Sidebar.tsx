import {
  ArrowRightLeft,
  Bot,
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
import { useLanguage } from '@/context/LanguageContext';
import { JVLogo } from '@/components/brand/JVLogo';

export interface NavEntry {
  to: string;
  labelKey: string;
  icon: ReactNode;
  capability?: Capability;
  end?: boolean;
}

export const STAFF_NAV: NavEntry[] = [
  { to: '/dashboard', labelKey: 'sidebar.dashboard', icon: <Gauge size={16} aria-hidden="true" />, end: true },
  { to: '/my-work', labelKey: 'sidebar.myWork', icon: <ListTodo size={16} aria-hidden="true" /> },
  {
    to: '/clients',
    labelKey: 'sidebar.clients',
    icon: <Building2 size={16} aria-hidden="true" />,
    capability: 'client:read',
  },
  {
    to: '/compliance',
    labelKey: 'sidebar.filings',
    icon: <CalendarClock size={16} aria-hidden="true" />,
    capability: 'compliance:read',
  },
  {
    to: '/automation',
    labelKey: 'sidebar.automation',
    icon: <Bot size={16} aria-hidden="true" />,
    capability: 'compliance:read',
  },
  {
    to: '/tasks',
    labelKey: 'sidebar.tasks',
    icon: <CheckSquare size={16} aria-hidden="true" />,
    capability: 'task:read',
  },
  {
    to: '/documents',
    labelKey: 'sidebar.documents',
    icon: <FileText size={16} aria-hidden="true" />,
    capability: 'document:read',
  },
  {
    to: '/converter',
    labelKey: 'sidebar.converter',
    icon: <ArrowRightLeft size={16} aria-hidden="true" />,
    capability: 'document:read',
  },
  {
    to: '/requests',
    labelKey: 'sidebar.requests',
    icon: <Inbox size={16} aria-hidden="true" />,
    capability: 'document_request:read',
  },
  {
    to: '/messages',
    labelKey: 'sidebar.messages',
    icon: <MessagesSquare size={16} aria-hidden="true" />,
    capability: 'message:threads',
  },
  {
    to: '/reports/compliance',
    labelKey: 'sidebar.reports',
    icon: <PieChart size={16} aria-hidden="true" />,
    capability: 'report:read',
  },
  {
    to: '/settings/firm',
    labelKey: 'sidebar.settings',
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
  const { t } = useLanguage();
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
          <span className="flex items-center gap-2.5">
            <JVLogo size="sm" />
            <span className="truncate text-sm font-semibold text-[var(--fd-text-primary)] tracking-tight">JV Tax Consultancy</span>
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
              title={narrow ? t(entry.labelKey) : undefined}
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
              {narrow ? <span className="sr-only">{t(entry.labelKey)}</span> : <span>{t(entry.labelKey)}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
