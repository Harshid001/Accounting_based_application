import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/cn';

const TABS = [
  { to: '/settings/firm', label: 'Firm' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/catalogue', label: 'Catalogue' },
  { to: '/settings/unlinked-accounts', label: 'Unlinked accounts' },
  { to: '/settings/audit', label: 'Audit log' },
  { to: '/settings/jobs', label: 'Jobs' },
];

export function SettingsNav() {
  return (
    <nav aria-label="Settings" data-print="hide" className="mb-5">
      <ul className="flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'inline-block rounded-md px-3 py-1.5 text-base transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
                  isActive
                    ? 'bg-[var(--fd-accent-subtle-bg)] font-medium text-[var(--fd-accent)]'
                    : 'text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)]',
                )
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
