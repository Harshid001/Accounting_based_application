import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { listUsers } from '@/api/users.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { UserStatusPill } from '@/components/domain/StatusPills';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { SettingsNav } from '@/routes/settings/components/SettingsNav';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ROLE_LABELS, USER_STATUS_LABELS } from '@/lib/constants';
import { relativeTime } from '@/lib/date';
import { joinNames } from '@/lib/format';
import { ROLES, USER_STATUSES } from '@/types/enums';
import type { AdminUser } from '@/types/models';

const FILTER_KEYS = ['role', 'status', 'unlinked'] as const;

export function UsersList() {
  usePageTitle('Users');
  const navigate = useNavigate();

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    labels: { role: 'Role', status: 'Status', unlinked: 'Unlinked' },
    valueLabels: {
      role: ROLE_LABELS,
      status: USER_STATUS_LABELS,
      unlinked: { true: 'Unlinked only' },
    },
  });

  const query = useQuery({
    queryKey: queryKeys.users.list(params.query),
    queryFn: () => listUsers(params.query),
    staleTime: 30_000,
  });

  const columns: Array<TableColumn<AdminUser>> = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <span className="min-w-0">
          <Link
            to={`/settings/users/${row.id}`}
            className="block truncate rounded-sm font-medium text-[var(--fd-text-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
          >
            {row.name}
          </Link>
          <span className="text-2xs block truncate text-[var(--fd-text-tertiary)]">
            {row.email}
          </span>
        </span>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => <Badge tone={row.role === 'admin' ? 'accent' : 'neutral'}>{ROLE_LABELS[row.role]}</Badge>,
    },
    { id: 'status', header: 'Status', cell: (row) => <UserStatusPill status={row.status} /> },
    {
      id: 'verified',
      header: 'Email',
      hideBelow: 'lg',
      cell: (row) =>
        row.emailVerified ? (
          <span className="text-[var(--fd-text-secondary)]">Verified</span>
        ) : (
          <Badge tone="waiting">Unverified</Badge>
        ),
    },
    {
      id: 'linked',
      header: 'Linked clients',
      hideBelow: 'lg',
      cell: (row) =>
        row.role === 'client' ? (
          row.linkedClients.length === 0 ? (
            <Badge tone="waiting">Unlinked</Badge>
          ) : (
            joinNames(
              row.linkedClients.map((client) => client.name),
              2,
            )
          )
        ) : (
          <span className="text-[var(--fd-text-tertiary)]">Firm-wide by role</span>
        ),
    },
    {
      id: 'lastSeen',
      header: 'Last seen',
      align: 'right',
      hideBelow: 'md',
      cell: (row) => (
        <span className="text-[var(--fd-text-secondary)]">
          {row.lastSeenAt === null ? 'Never' : relativeTime(row.lastSeenAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Users" description="Every account that can sign in to FirmDesk." />
      <SettingsNav />

      <FilterBar
        search={params.search}
        onSearchChange={params.setSearch}
        searchPlaceholder="Search by name or email"
        values={params.filters}
        onFilterChange={params.setFilter}
        activeFilters={params.activeFilters}
        onClear={params.clearFilters}
        filters={[
          {
            key: 'role',
            label: 'Role',
            options: ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
          },
          {
            key: 'status',
            label: 'Status',
            options: USER_STATUSES.map((status) => ({
              value: status,
              label: USER_STATUS_LABELS[status],
            })),
          },
          {
            key: 'unlinked',
            label: 'Unlinked',
            allLabel: 'All accounts',
            options: [{ value: 'true', label: 'Unlinked only' }],
          },
        ]}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Users did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="account" />

          <DataTable
            caption="Users"
            columns={columns}
            rows={query.data?.items ?? []}
            rowKey={(row) => row.id}
            state={query.isPending ? 'loading' : 'ready'}
            onRowClick={(row) => {
              void navigate(`/settings/users/${row.id}`);
            }}
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
                  icon={<Users size={20} aria-hidden="true" />}
                  title="No accounts yet"
                  description="Anyone can sign up at the public link. They arrive here as unlinked client accounts."
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
              label="accounts"
            />
          )}
        </>
      )}
    </>
  );
}
