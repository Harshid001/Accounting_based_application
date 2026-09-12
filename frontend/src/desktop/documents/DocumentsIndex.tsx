import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, FileText } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { listDocuments } from '@/api/documents.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { DocumentList } from '@/components/domain/DocumentList';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { VersionHistory } from '@/desktop/documents/components/VersionHistory';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { DOCUMENT_TYPES } from '@/types/enums';
import type { DocumentListRow } from '@/types/models';

const FILTER_KEYS = ['documentType', 'archived'] as const;

export function DocumentsIndex() {
  usePageTitle('Documents');
  const [versionsFor, setVersionsFor] = useState<DocumentListRow | null>(null);

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    defaultSort: 'createdAt:desc',
    labels: { documentType: 'Type', archived: 'Archived' },
    valueLabels: {
      documentType: DOCUMENT_TYPE_LABELS,
      archived: { true: 'Archived only', false: 'Active only' },
    },
  });

  const query = useQuery({
    queryKey: queryKeys.documents.list(params.query),
    queryFn: ({ signal }) => listDocuments(params.query, signal),
    staleTime: 30_000,
  });

  const presets = [
    {
      id: 'pan',
      label: '🆔 Identity & KYC',
      active: params.filters.documentType === 'pan',
      onClick: () => {
        params.setFilter('documentType', params.filters.documentType === 'pan' ? null : 'pan');
      },
    },
    {
      id: 'tax_return',
      label: '📑 Tax Returns',
      active: params.filters.documentType === 'tax_return',
      onClick: () => {
        params.setFilter('documentType', params.filters.documentType === 'tax_return' ? null : 'tax_return');
      },
    },
    {
      id: 'bank_statement',
      label: '🏦 Bank Statements',
      active: params.filters.documentType === 'bank_statement',
      onClick: () => {
        params.setFilter('documentType', params.filters.documentType === 'bank_statement' ? null : 'bank_statement');
      },
    },
    {
      id: 'invoice',
      label: '🧾 Invoices & Bills',
      active: params.filters.documentType === 'invoice',
      onClick: () => {
        params.setFilter('documentType', params.filters.documentType === 'invoice' ? null : 'invoice');
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Documents"
        featureKey="documents"
        description="Every file across the clients in your scope. Uploads happen from a client record."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link to="/converter" className="flex items-center gap-1.5">
              <ArrowRightLeft size={14} aria-hidden="true" />
              <span>File Converter</span>
            </Link>
          </Button>
        }
      />

      <div data-tour="doc-search">
        <div data-tour="doc-filter">
          <FilterBar
            search={params.search}
            onSearchChange={params.setSearch}
            searchPlaceholder="Search document titles"
            presets={presets}
            values={params.filters}
            onFilterChange={params.setFilter}
            activeFilters={params.activeFilters}
            onClear={params.clearFilters}
            filters={[
              {
                key: 'documentType',
                label: 'Type',
                options: DOCUMENT_TYPES.map((type) => ({
                  value: type,
                  label: DOCUMENT_TYPE_LABELS[type],
                })),
              },
              {
                key: 'archived',
                label: 'Archived',
                allLabel: 'Active only',
                options: [{ value: 'true', label: 'Archived only' }],
              },
            ]}
          />
        </div>
      </div>

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Documents did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="document" />

          <div data-tour="doc-table">
            <DocumentList
              showClient
              documents={query.data?.items ?? []}
            loading={query.isPending}
            onOpenVersions={setVersionsFor}
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
                  icon={<FileText size={20} aria-hidden="true" />}
                  title="No documents yet"
                  description="Open a client record and upload the first file, or raise a request and let them upload it."
                />
              )
            }
          />
          </div>

          {query.data === undefined || query.data.total === 0 ? null : (
            <Pagination
              page={query.data.page}
              limit={query.data.limit}
              total={query.data.total}
              totalPages={query.data.totalPages}
              onPageChange={params.setPage}
              onLimitChange={params.setLimit}
              label="documents"
            />
          )}
        </>
      )}

      <VersionHistory
        document={versionsFor}
        clientId={versionsFor?.client?.id ?? ''}
        onClose={() => {
          setVersionsFor(null);
        }}
      />
    </>
  );
}
