import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { listAccounts, updateAccount } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { IconButton } from '@/components/ui/icon-button';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ACCOUNT_SUB_TYPE_LABELS, ACCOUNT_TYPE_LABELS } from '@/lib/constants';
import { AccountFormDialog } from '@/desktop/books/components/AccountFormDialog';
import {
  BooksClientBar,
  BooksTabs,
  ChooseClientState,
  useBooksClient,
} from '@/desktop/books/components/BooksShell';
import { ACCOUNT_TYPES } from '@/types/enums';
import type { AccountView } from '@/types/models';

const FILTER_KEYS = ['client', 'type', 'includeInactive'] as const;

export function ChartOfAccounts() {
  usePageTitle('Chart of accounts');
  const [clientId, setClientId] = useBooksClient();
  const { allows } = useSession();
  const { success, errorToast } = useToast();
  const queryClient = useQueryClient();

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    defaultSort: 'code:asc',
    labels: { type: 'Type', includeInactive: 'Inactive' },
    valueLabels: { type: ACCOUNT_TYPE_LABELS, includeInactive: { true: 'shown' } },
  });

  const [dialog, setDialog] = useState<{ open: boolean; account: AccountView | null }>({
    open: false,
    account: null,
  });

  const query = useQuery({
    queryKey: queryKeys.books.accounts.list(params.query),
    queryFn: ({ signal }) => listAccounts(params.query, signal),
    enabled: clientId !== null,
    staleTime: 30_000,
  });

  const toggleActive = useMutation({
    mutationFn: (account: AccountView) =>
      updateAccount(account.id, { isActive: !account.isActive }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.books.all });
      success(saved.isActive ? 'Account reactivated' : 'Account deactivated', saved.name);
    },
    onError: (error: unknown) => {
      errorToast(error, 'That change did not save');
    },
  });

  const canWrite = allows('books:write');
  const suffix = clientId === null ? '' : `?client=${clientId}`;

  const columns: Array<TableColumn<AccountView>> = [
    {
      id: 'code',
      header: 'Code',
      sortField: 'code',
      width: '9rem',
      cell: (row) => (
        <Link
          to={`/books/ledger${suffix}&account=${row.id}`}
          className="numeric font-medium text-[var(--fd-accent)] hover:underline"
        >
          {row.code}
        </Link>
      ),
    },
    {
      id: 'name',
      header: 'Account',
      sortField: 'name',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className={row.isActive ? '' : 'text-[var(--fd-text-tertiary)] line-through'}>
            {row.name}
          </span>
          {row.isSystem ? <Badge tone="muted">engine</Badge> : null}
          {!row.isActive ? <Badge tone="neutral">inactive</Badge> : null}
        </span>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      sortField: 'type',
      hideBelow: 'md',
      cell: (row) => ACCOUNT_TYPE_LABELS[row.type],
    },
    {
      id: 'subType',
      header: 'Sub-type',
      hideBelow: 'lg',
      cell: (row) => (row.subType === null ? '—' : ACCOUNT_SUB_TYPE_LABELS[row.subType]),
    },
    {
      id: 'party',
      header: 'GSTIN / PAN',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="numeric text-xs">{row.party?.gstin ?? row.party?.pan ?? '—'}</span>
      ),
    },
    {
      id: 'opening',
      header: 'Opening',
      align: 'right',
      cell: (row) => (
        <span className="numeric">
          {row.openingBalance.paise === 0
            ? '—'
            : `${row.openingBalance.display} ${row.openingBalance.side}`}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Chart of accounts"
        description="Every ledger account for this client. Engine accounts hold GST and TDS and are maintained automatically."
        actions={
          clientId !== null && canWrite ? (
            <Button
              variant="primary"
              iconLeft={<Plus size={16} aria-hidden="true" />}
              onClick={() => {
                setDialog({ open: true, account: null });
              }}
            >
              Add account
            </Button>
          ) : null
        }
      />
      <BooksTabs clientId={clientId} />
      <BooksClientBar clientId={clientId} onClientChange={setClientId} />

      {clientId === null ? (
        <ChooseClientState />
      ) : (
        <>
          <FilterBar
            showSearch
            search={params.search}
            onSearchChange={params.setSearch}
            searchPlaceholder="Search by code or name"
            values={params.filters}
            onFilterChange={params.setFilter}
            activeFilters={params.activeFilters}
            onClear={() => {
              params.setFilters({ type: null, includeInactive: null });
              params.setSearch('');
            }}
            filters={[
              {
                key: 'type',
                label: 'Type',
                allLabel: 'All types',
                options: ACCOUNT_TYPES.map((type) => ({
                  value: type,
                  label: ACCOUNT_TYPE_LABELS[type],
                })),
              },
            ]}
            extra={
              <div className="min-w-40">
                <Select
                  ariaLabel="Inactive accounts"
                  size="sm"
                  value={params.filters.includeInactive === 'true' ? 'true' : 'false'}
                  onValueChange={(value) => {
                    params.setFilter('includeInactive', value === 'true' ? 'true' : null);
                  }}
                  options={[
                    { value: 'false', label: 'Active only' },
                    { value: 'true', label: 'Include inactive' },
                  ]}
                />
              </div>
            }
          />

          {query.isError ? (
            <ErrorState
              error={query.error}
              title="The chart of accounts did not load"
              onRetry={() => {
                void query.refetch();
              }}
            />
          ) : (
            <>
              <ListToolbar total={query.data?.total ?? null} noun="account" />
              <DataTable
                caption="Chart of accounts"
                columns={columns}
                rows={query.data?.items ?? []}
                rowKey={(row) => row.id}
                density="compact"
                state={query.isPending ? 'loading' : 'ready'}
                sort={
                  params.sortField === null
                    ? null
                    : { field: params.sortField, direction: params.sortDirection }
                }
                onSortChange={params.toggleSort}
                rowActions={
                  canWrite
                    ? (row) =>
                        row.isSystem ? null : (
                          <div className="flex items-center gap-1">
                            <IconButton
                              label={`Edit ${row.code}`}
                              size="sm"
                              variant="ghost"
                              icon={<Pencil size={14} aria-hidden="true" />}
                              onClick={() => {
                                setDialog({ open: true, account: row });
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={
                                toggleActive.isPending && toggleActive.variables?.id === row.id
                              }
                              onClick={() => {
                                toggleActive.mutate(row);
                              }}
                            >
                              {row.isActive ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          </div>
                        )
                    : undefined
                }
                emptySlot={
                  params.hasFilters || params.search.length > 0 ? (
                    <FilteredEmptyState
                      activeFilters={params.activeFilters.map((f) => `${f.label}: ${f.value}`)}
                      onClear={params.clearFilters}
                    />
                  ) : (
                    <EmptyState
                      icon={<BookOpen size={20} aria-hidden="true" />}
                      title="No accounts yet"
                      description="Add cash, bank, debtor, creditor, income and expense accounts. Engine accounts for GST and TDS appear on the first voucher."
                      action={
                        canWrite ? (
                          <Button
                            variant="primary"
                            onClick={() => {
                              setDialog({ open: true, account: null });
                            }}
                          >
                            Add the first account
                          </Button>
                        ) : undefined
                      }
                    />
                  )
                }
              />
              {(query.data?.total ?? 0) > 0 ? (
                <Pagination
                  page={params.page}
                  limit={params.limit}
                  total={query.data?.total ?? 0}
                  totalPages={query.data?.totalPages ?? 1}
                  onPageChange={params.setPage}
                  onLimitChange={params.setLimit}
                  label="accounts"
                />
              ) : null}
            </>
          )}

          <AccountFormDialog
            open={dialog.open}
            onOpenChange={(open) => {
              setDialog((previous) => ({ ...previous, open }));
            }}
            clientId={clientId}
            account={dialog.account}
          />
        </>
      )}
    </>
  );
}
