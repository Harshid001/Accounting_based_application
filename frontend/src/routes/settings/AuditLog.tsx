import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';

import { listAuditEntries } from '@/api/audit.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { SettingsNav } from '@/routes/settings/components/SettingsNav';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AUDIT_ACTION_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/date';
import { AUDIT_ACTIONS, AUDIT_ENTITY_KINDS } from '@/types/enums';
import type { AuditEntry } from '@/types/models';

const FILTER_KEYS = ['action', 'entityKind', 'dateFrom', 'dateTo'] as const;

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length === 0 ? '—' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

export function AuditLog() {
  usePageTitle('Audit log');
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    labels: {
      action: 'Action',
      entityKind: 'Entity',
      dateFrom: 'From',
      dateTo: 'To',
    },
    valueLabels: { action: AUDIT_ACTION_LABELS },
  });

  const query = useQuery({
    queryKey: queryKeys.audit.list(params.query),
    queryFn: ({ signal }) => listAuditEntries(params.query, signal),
    staleTime: 20_000,
  });

  const columns: Array<TableColumn<AuditEntry>> = [
    {
      id: 'when',
      header: 'When',
      cell: (row) => <span className="numeric">{formatDateTime(row.createdAt)}</span>,
    },
    {
      id: 'actor',
      header: 'Who',
      cell: (row) => (
        <span className="min-w-0">
          <span className="block truncate text-[var(--fd-text-primary)]">
            {row.actor?.name ?? 'System'}
          </span>
          {row.actorRole === null ? null : (
            <span className="text-2xs block text-[var(--fd-text-tertiary)]">{row.actorRole}</span>
          )}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (row) => (
        <Badge tone={row.action === 'reveal_aadhaar' ? 'danger' : 'neutral'}>
          {AUDIT_ACTION_LABELS[row.action] ?? row.action}
        </Badge>
      ),
    },
    {
      id: 'entity',
      header: 'Entity',
      hideBelow: 'lg',
      cell: (row) => <span className="text-[var(--fd-text-secondary)]">{row.entityKind}</span>,
    },
    {
      id: 'client',
      header: 'Client',
      hideBelow: 'md',
      cell: (row) => row.client?.name ?? '—',
    },
    {
      id: 'summary',
      header: 'What happened',
      cell: (row) => (
        <span className="block truncate text-[var(--fd-text-secondary)]">
          {row.summary ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only. There is no route that edits or deletes an entry, at any role."
      />
      <SettingsNav />

      <FilterBar
        showSearch={false}
        search=""
        onSearchChange={() => undefined}
        values={params.filters}
        onFilterChange={params.setFilter}
        activeFilters={params.activeFilters}
        onClear={params.clearFilters}
        filters={[
          {
            key: 'action',
            label: 'Action',
            options: AUDIT_ACTIONS.map((action) => ({
              value: action,
              label: AUDIT_ACTION_LABELS[action] ?? action,
            })),
          },
          {
            key: 'entityKind',
            label: 'Entity',
            options: AUDIT_ENTITY_KINDS.map((kind) => ({ value: kind, label: kind })),
          },
        ]}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="The audit log did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="entry" />

          <DataTable
            caption="Audit log"
            columns={columns}
            rows={query.data?.items ?? []}
            rowKey={(row) => row.id}
            state={query.isPending ? 'loading' : 'ready'}
            onRowClick={setSelected}
            emptySlot={
              params.hasFilters ? (
                <FilteredEmptyState
                  activeFilters={params.activeFilters.map(
                    (filter) => `${filter.label}: ${filter.value}`,
                  )}
                  onClear={params.clearFilters}
                />
              ) : (
                <EmptyState
                  icon={<ScrollText size={20} aria-hidden="true" />}
                  title="Nothing recorded yet"
                  description="Every create, update, status change, export and Aadhaar reveal lands here."
                />
              )
            }
          />

          {query.data === undefined || query.data.total === 0 ? null : (
            <Pagination
              page={query.data.page}
              limit={query.data.limit}
              total={query.data.total}
              totalPages={query.data.totalPages}
              onPageChange={params.setPage}
              onLimitChange={params.setLimit}
              label="entries"
            />
          )}
        </>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
        size="lg"
        title={
          selected === null
            ? 'Audit entry'
            : (AUDIT_ACTION_LABELS[selected.action] ?? selected.action)
        }
        description={selected?.summary ?? undefined}
      >
        {selected === null ? null : (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-2xs text-[var(--fd-text-tertiary)] uppercase">When</dt>
                <dd className="numeric text-base">{formatDateTime(selected.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-2xs text-[var(--fd-text-tertiary)] uppercase">Who</dt>
                <dd className="text-base">{selected.actor?.name ?? 'System'}</dd>
              </div>
              <div>
                <dt className="text-2xs text-[var(--fd-text-tertiary)] uppercase">IP address</dt>
                <dd className="numeric text-base">{selected.ip ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-2xs text-[var(--fd-text-tertiary)] uppercase">Request id</dt>
                <dd className="font-mono text-xs break-all">{selected.requestId ?? '—'}</dd>
              </div>
            </dl>

            {selected.diff.length === 0 ? (
              <p className="text-base text-[var(--fd-text-tertiary)]">
                No field-level changes were recorded for this action.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--fd-border-subtle)]">
                <table className="w-full text-left text-base">
                  <caption className="sr-only">Field changes</caption>
                  <thead className="bg-[var(--fd-surface-2)]">
                    <tr>
                      <th scope="col" className="text-2xs px-3 py-2 uppercase">
                        Field
                      </th>
                      <th scope="col" className="text-2xs px-3 py-2 uppercase">
                        Before
                      </th>
                      <th scope="col" className="text-2xs px-3 py-2 uppercase">
                        After
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.diff.map((change) => (
                      <tr key={change.field} className="border-t border-[var(--fd-border-subtle)]">
                        <td className="px-3 py-2 font-medium">{change.field}</td>
                        {change.redacted ? (
                          <td colSpan={2} className="px-3 py-2 text-[var(--fd-text-tertiary)]">
                            Redacted — the field changed, the values are never recorded.
                          </td>
                        ) : (
                          <>
                            <td className="px-3 py-2 break-words text-[var(--fd-text-secondary)]">
                              {renderValue(change.before)}
                            </td>
                            <td className="px-3 py-2 break-words text-[var(--fd-text-primary)]">
                              {renderValue(change.after)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
