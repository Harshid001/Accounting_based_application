import { BookOpen } from 'lucide-react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import type { StatusTone } from '@/components/ui/status-pill';
import { ClientPicker } from '@/components/domain/ClientPicker';
import { VOUCHER_STATUS_LABELS, VOUCHER_TYPE_LABELS } from '@/lib/constants';
import type { VoucherStatus, VoucherType } from '@/types/enums';

/** Books routes keep the chosen client in `?client=` so every tab shares it. */
export const BOOKS_CLIENT_PARAM = 'client';

export const BOOKS_TABS = [
  { to: '/books', label: 'Overview', end: true },
  { to: '/books/vouchers', label: 'Vouchers' },
  { to: '/books/day-book', label: 'Day book' },
  { to: '/books/ledger', label: 'Ledger' },
  { to: '/books/trial-balance', label: 'Trial balance' },
  { to: '/books/accounts', label: 'Chart of accounts' },
] as const;

export function useBooksClient(): [string | null, (value: string | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get(BOOKS_CLIENT_PARAM);
  const setClientId = useCallback(
    (value: string | null) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (value === null) next.delete(BOOKS_CLIENT_PARAM);
          else next.set(BOOKS_CLIENT_PARAM, value);
          // A new client invalidates every other filter (account ids differ per client).
          for (const key of [...next.keys()]) {
            if (key !== BOOKS_CLIENT_PARAM) next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  return [clientId !== null && clientId.length > 0 ? clientId : null, setClientId];
}

export function BooksTabs({ clientId }: { clientId: string | null }) {
  const suffix = clientId === null ? '' : `?${BOOKS_CLIENT_PARAM}=${clientId}`;
  return (
    <nav aria-label="Books" data-print="hide" className="mb-4">
      <ul className="flex flex-wrap gap-1">
        {BOOKS_TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={`${tab.to}${suffix}`}
              end={'end' in tab ? tab.end : false}
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

export interface BooksClientBarProps {
  clientId: string | null;
  onClientChange: (value: string | null) => void;
  children?: React.ReactNode;
}

export function BooksClientBar({ clientId, onClientChange, children }: BooksClientBarProps) {
  return (
    <Card data-print="hide" className="mb-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <span
            aria-hidden="true"
            className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]"
          >
            Client
          </span>
          <ClientPicker ariaLabel="Client" value={clientId} onChange={onClientChange} allowClear />
        </div>
        {children}
      </div>
    </Card>
  );
}

export function ChooseClientState() {
  return (
    <EmptyState
      icon={<BookOpen size={20} aria-hidden="true" />}
      title="Choose a client to open their books"
      description="Every voucher, ledger and trial balance belongs to one client. Pick one above to begin."
    />
  );
}

const STATUS_TONE: Record<VoucherStatus, StatusTone> = {
  draft: 'waiting',
  posted: 'done',
  reversed: 'muted',
  locked: 'confirmed',
};

export function VoucherStatusPill({ status }: { status: VoucherStatus }) {
  return (
    <StatusPill
      tone={STATUS_TONE[status]}
      label={VOUCHER_STATUS_LABELS[status]}
      dashed={status === 'draft'}
    />
  );
}

export function VoucherTypeLabel({ type }: { type: VoucherType }) {
  return <span className="text-[var(--fd-text-secondary)]">{VOUCHER_TYPE_LABELS[type]}</span>;
}
