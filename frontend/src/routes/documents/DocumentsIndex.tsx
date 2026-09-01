import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useState } from 'react';

import { listDocuments } from '@/api/documents.api';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { DocumentList } from '@/components/domain/DocumentList';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { VersionHistory } from '@/routes/documents/components/VersionHistory';
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

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every file across the clients in your scope. Uploads happen from a client record."
      />

      <FilterBar
        search={params.search}
        onSearchChange={params.setSearch}
        searchPlaceholder="Search document titles"
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
