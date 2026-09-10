import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';

import { listWorkstations, revokeWorkstation, type WorkstationView } from '@/api/desktop.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SettingsNav } from '@/routes/settings/components/SettingsNav';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/context/ToastContext';
import { formatDateTime, relativeTime } from '@/lib/date';

const FILTER_KEYS = ['q'] as const;

/**
 * Admin-only (spec §5.6): every registered FirmDesk desktop workstation,
 * its live Tally probe state, and one-click revoke. Revoking abandons the
 * workstation's queued commands immediately; its next heartbeat 403s.
 */
export function WorkstationsPage() {
  usePageTitle('Workstations');
  const queryClient = useQueryClient();
  const { success, errorToast } = useToast();
  const [revokeTarget, setRevokeTarget] = useState<WorkstationView | null>(null);

  const params = useListParams({ filterKeys: FILTER_KEYS, labels: {} });

  const query = useQuery({
    queryKey: queryKeys.desktop.workstations(params.query),
    queryFn: () =>
      listWorkstations({
        page: params.page,
        limit: params.limit,
        q: params.search.length > 0 ? params.search : undefined,
      }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeWorkstation(id),
    onSuccess: () => {
      setRevokeTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['desktop'] });
      success(
        'Workstation revoked',
        'Its queued commands were abandoned and its next heartbeat will be refused.',
      );
    },
    onError: (error: unknown) => {
      errorToast(error, 'The workstation was not revoked');
    },
  });

  const columns: Array<TableColumn<WorkstationView>> = [
    {
      id: 'device',
      header: 'Workstation',
      cell: (row) => (
        <span className="min-w-0">
          <span className="block truncate font-medium text-[var(--fd-text-primary)]">
            {row.deviceName}
          </span>
          <span className="text-2xs block truncate text-[var(--fd-text-tertiary)]">
            {row.userName ?? 'Unassigned'} · {row.platform ?? '—'} · v{row.appVersion ?? '0'}
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) =>
        row.revoked ? (
          <Badge tone="danger">Revoked</Badge>
        ) : (
          <Badge tone={row.online ? 'done' : 'muted'}>{row.online ? 'Online' : 'Offline'}</Badge>
        ),
    },
    {
      id: 'tally',
      header: 'Tally',
      hideBelow: 'md',
      cell: (row) => (
        <span className="min-w-0">
          <span className="block truncate text-[var(--fd-text-secondary)]">
            {row.tally.reachable ? (row.tally.companyName ?? 'Connected') : 'Not reachable'}
          </span>
          {row.tally.educationMode ? (
            <Badge tone="waiting">Education mode</Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'lastSeen',
      header: 'Last seen',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="numeric" title={formatDateTime(row.lastSeenAt)}>
          {relativeTime(row.lastSeenAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) =>
        row.revoked ? null : (
          <Button variant="secondary" size="sm" onClick={() => setRevokeTarget(row)}>
            Revoke
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Workstations"
        description="Every machine running the FirmDesk desktop app — the Tally bridge. Revoking a workstation immediately abandons its queued Tally commands."
      />
      <SettingsNav />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Device registry"
            description="A workstation is online when its heartbeat is under two minutes old; the Tally column shows its last live probe."
            actions={<MonitorSmartphone size={16} aria-hidden="true" />}
          />
        </Card>

      <FilterBar
        search={params.search}
        onSearchChange={params.setSearch}
        searchPlaceholder="Search by device name or id"
        filters={[]}
        values={{}}
        onFilterChange={() => undefined}
        activeFilters={[]}
        onClear={params.clearFilters}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Workstations did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="workstation" />

          <DataTable
            caption="Registered workstations"
            columns={columns}
            rows={query.data?.items ?? []}
            rowKey={(row) => row.id}
            state={query.isPending ? 'loading' : 'ready'}
            emptySlot={
              params.search.length > 0 ? (
                <FilteredEmptyState activeFilters={['Search']} onClear={params.clearFilters} />
              ) : (
                <EmptyState
                  icon={<MonitorSmartphone size={20} aria-hidden="true" />}
                  title="No workstations registered"
                  description="Install the FirmDesk desktop app on an accountant's machine and sign in — it registers itself."
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
                label="workstations"
              />
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="Revoke this workstation?"
        body={
          revokeTarget === null
            ? ''
            : `${revokeTarget.deviceName} will be refused its next heartbeat and any queued commands are abandoned. The user must re-register the device after an admin restores access.`
        }
        confirmLabel="Revoke workstation"
        destructive
        pending={revoke.isPending}
        onConfirm={() => {
          if (revokeTarget !== null) revoke.mutate(revokeTarget.id);
        }}
      />
    </>
  );
}
