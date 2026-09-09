import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchBooksStatus, lockPeriod } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { BOOKS_MODE_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/date';
import {
  BooksClientBar,
  BooksTabs,
  ChooseClientState,
  useBooksClient,
} from '@/routes/books/components/BooksShell';
import { TallyBridgeCard } from '@/routes/books/components/TallyBridgeCard';

export function BooksOverview() {
  usePageTitle('Books');
  const [clientId, setClientId] = useBooksClient();
  const { allows } = useSession();
  const { success, errorToast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.books.status(clientId ?? ''),
    queryFn: () => fetchBooksStatus(clientId ?? ''),
    enabled: clientId !== null,
  });

  const [period, setPeriod] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const lock = useMutation({
    mutationFn: () =>
      lockPeriod(period.trim(), {
        clientId: clientId ?? '',
        confirm: `LOCK ${period.trim().replace(/^FY\s+/i, '')}`,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.books.all });
      success('Period locked', `${created.period} can no longer take new postings.`);
      setPeriod('');
      setConfirmOpen(false);
    },
    onError: (error: unknown) => {
      errorToast(error, 'That period was not locked');
      setConfirmOpen(false);
    },
  });

  const suffix = clientId === null ? '' : `?client=${clientId}`;
  const status = query.data;

  return (
    <>
      <PageHeader
        title="Books"
        description="Double-entry books for each client: vouchers, ledgers and the trial balance the returns are computed from."
        actions={
          clientId !== null && allows('books:write') ? (
            <Button asChild variant="primary" iconLeft={<Plus size={16} aria-hidden="true" />}>
              <Link to={`/books/vouchers/new${suffix}`}>New voucher</Link>
            </Button>
          ) : null
        }
      />
      <BooksTabs clientId={clientId} />
      <BooksClientBar clientId={clientId} onClientChange={setClientId} />

      {clientId === null ? (
        <ChooseClientState />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          title="These books did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile
              label="Drafts"
              value={status?.vouchers.draft ?? null}
              tone="waiting"
              to={`/books/vouchers${suffix}&status=draft`}
              loading={query.isPending}
            />
            <StatTile
              label="Posted"
              value={status?.vouchers.posted ?? null}
              to={`/books/vouchers${suffix}&status=posted`}
              loading={query.isPending}
            />
            <StatTile
              label="Locked"
              value={status?.vouchers.locked ?? null}
              loading={query.isPending}
            />
            <StatTile
              label="Reversed"
              value={status?.vouchers.reversed ?? null}
              loading={query.isPending}
            />
            <StatTile
              label="Accounts"
              value={status?.accounts ?? null}
              to={`/books/accounts${suffix}`}
              loading={query.isPending}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Where the books live" />
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--fd-text-secondary)]">Mode</dt>
                  <dd>
                    {status ? (
                      <Badge tone={status.booksMode === 'native' ? 'accent' : 'neutral'}>
                        {BOOKS_MODE_LABELS[status.booksMode]}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                {status?.tallyConfig ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--fd-text-secondary)]">Tally company</dt>
                    <dd className="text-right">
                      {status.tallyConfig.companyName}{' '}
                      <span className="text-[var(--fd-text-tertiary)]">
                        ({status.tallyConfig.edition === 'prime' ? 'Prime' : 'ERP 9'})
                      </span>
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--fd-text-secondary)]">Last posting</dt>
                  <dd className="numeric">
                    {formatDateTime(status?.lastPostedAt ?? null, 'Nothing posted yet')}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-[var(--fd-text-tertiary)]">
                Change the mode from the client record. Tally posting arrives with the desktop app.
              </p>
            </Card>

            <Card>
              <CardHeader
                title="Period locks"
                description="A locked period cannot take new postings. Corrections go through a reversal dated in an open period."
              />
              {status && status.locks.length > 0 ? (
                <ul className="mt-3 divide-y divide-[var(--fd-border-subtle)] text-sm">
                  {status.locks.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2">
                        <Lock size={14} aria-hidden="true" />
                        <span className="font-medium">{entry.period}</span>
                        <span className="text-[var(--fd-text-tertiary)]">
                          {formatDate(entry.periodStart)} – {formatDate(entry.periodEnd)}
                        </span>
                      </span>
                      <span className="text-xs text-[var(--fd-text-tertiary)]">
                        locked {formatDate(entry.lockedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--fd-text-secondary)]">
                  No periods locked yet.
                </p>
              )}

              {allows('books:lock') ? (
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <div className="min-w-40 flex-1">
                    <FormField
                      label="Lock a period"
                      helper="A month like 2026-09, or a financial year like 2026-27."
                    >
                      {({ inputId, describedBy }) => (
                        <Input
                          id={inputId}
                          aria-describedby={describedBy}
                          value={period}
                          placeholder="2026-09"
                          onChange={(event) => {
                            setPeriod(event.target.value);
                          }}
                        />
                      )}
                    </FormField>
                  </div>
                  <Button
                    variant="danger"
                    disabled={period.trim().length === 0}
                    iconLeft={<Lock size={14} aria-hidden="true" />}
                    onClick={() => {
                      setConfirmOpen(true);
                    }}
                  >
                    Lock
                  </Button>
                </div>
              ) : null}
            </Card>
          </div>

          {status && status.booksMode !== 'native' ? (
            <TallyBridgeCard clientId={clientId} />
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Lock ${period.trim()}?`}
        body="Posted vouchers in this period become permanent. No new entries can be posted with a date inside it. This cannot be undone."
        confirmLabel="Lock period"
        destructive
        typedConfirmation={`LOCK ${period.trim().replace(/^FY\s+/i, '')}`}
        typedHint="Type the confirmation exactly as shown."
        pending={lock.isPending}
        onConfirm={() => {
          lock.mutate();
        }}
      />
    </>
  );
}
