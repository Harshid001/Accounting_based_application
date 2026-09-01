import { useQuery } from '@tanstack/react-query';
import { FileText, Upload } from 'lucide-react';
import { useState } from 'react';

import { listDocuments } from '@/api/documents.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { DocumentList } from '@/components/domain/DocumentList';
import { DocumentUploader } from '@/components/domain/DocumentUploader';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { useActiveClient } from '@/context/ActiveClientContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { DOCUMENT_TYPES } from '@/types/enums';

export function PortalDocuments() {
  usePageTitle('Your documents');
  const { activeClientId } = useActiveClient();
  const clientId = activeClientId ?? '';
  const [uploadOpen, setUploadOpen] = useState(false);

  const params = useListParams({
    filterKeys: ['documentType'],
    defaultSort: 'createdAt:desc',
    labels: { documentType: 'Type' },
    valueLabels: { documentType: DOCUMENT_TYPE_LABELS },
  });

  const scoped = { ...params.query, client: clientId };
  const query = useQuery({
    queryKey: queryKeys.documents.list(scoped),
    queryFn: ({ signal }) => listDocuments(scoped, signal),
    enabled: clientId.length > 0,
    staleTime: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Your documents"
        description="Everything on file for you, and anything you have sent your firm."
        actions={
          <Button
            variant="primary"
            iconLeft={<Upload size={15} aria-hidden="true" />}
            onClick={() => {
              setUploadOpen(true);
            }}
          >
            Upload a document
          </Button>
        }
      />

      <FilterBar
        search={params.search}
        onSearchChange={params.setSearch}
        searchPlaceholder="Search your documents"
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
        ]}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Your documents did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="document" />

          <DocumentList
            documents={query.data?.items ?? []}
            loading={query.isPending}
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
                  title="Nothing on file yet"
                  description="Upload a document, or wait for your firm to ask for something specific."
                  action={
                    <Button
                      variant="primary"
                      onClick={() => {
                        setUploadOpen(true);
                      }}
                    >
                      Upload a document
                    </Button>
                  }
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

      {clientId.length === 0 ? null : (
        <DocumentUploader
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          clientId={clientId}
          title="Send your firm a document"
          onUploaded={() => {
            void query.refetch();
          }}
        />
      )}
    </>
  );
}
