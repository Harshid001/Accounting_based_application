import { useQuery } from '@tanstack/react-query';
import { FileText, Upload } from 'lucide-react';
import { useState } from 'react';

import { listDocuments } from '@/api/documents.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { DocumentList } from '@/components/domain/DocumentList';
import { DocumentUploader } from '@/components/domain/DocumentUploader';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { VersionHistory } from '@/routes/documents/components/VersionHistory';
import { useClientRecord } from '@/routes/clients/ClientRecord';
import { useListParams } from '@/hooks/useListParams';
import { useSession } from '@/context/SessionContext';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { DOCUMENT_TYPES } from '@/types/enums';
import type { DocumentListRow } from '@/types/models';

const FILTER_KEYS = ['documentType', 'archived'] as const;

export function DocumentsTab() {
  const { clientId, readOnly } = useClientRecord();
  const { allows } = useSession();
  const [uploadOpen, setUploadOpen] = useState(false);
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
    queryKey: queryKeys.documents.list({ ...params.query, client: clientId }),
    queryFn: ({ signal }) => listDocuments({ ...params.query, client: clientId }, signal),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
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
          <ListToolbar total={query.data?.total ?? null} noun="document">
            {allows('document:write') && !readOnly ? (
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Upload size={14} aria-hidden="true" />}
                onClick={() => {
                  setUploadOpen(true);
                }}
              >
                Upload document
              </Button>
            ) : null}
          </ListToolbar>

          <DocumentList
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
                  description="Upload the first file, or raise a request and let the client upload it themselves."
                  action={
                    allows('document:write') && !readOnly ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setUploadOpen(true);
                        }}
                      >
                        Upload document
                      </Button>
                    ) : undefined
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

      <DocumentUploader
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        clientId={clientId}
        onUploaded={() => {
          void query.refetch();
        }}
      />

      <VersionHistory
        document={versionsFor}
        clientId={clientId}
        onClose={() => {
          setVersionsFor(null);
        }}
      />
    </div>
  );
}
