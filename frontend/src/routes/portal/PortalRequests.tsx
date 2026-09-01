import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

import { listPortalRequests } from '@/api/portal.api';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentUploader } from '@/components/domain/DocumentUploader';
import { FilterBar } from '@/components/domain/FilterBar';
import { PortalRequestCard } from '@/routes/portal/components/PortalRequestCard';
import { useActiveClient } from '@/context/ActiveClientContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { REQUEST_STATUS_LABELS } from '@/lib/constants';
import { DOCUMENT_REQUEST_STATUSES } from '@/types/enums';
import type { PortalDocumentRequestView } from '@/types/models';

export function PortalRequests() {
  usePageTitle('What your firm needs');
  const { activeClientId } = useActiveClient();
  const clientId = activeClientId ?? '';
  const [uploadFor, setUploadFor] = useState<PortalDocumentRequestView | null>(null);

  const params = useListParams({
    filterKeys: ['status'],
    labels: { status: 'Status' },
    valueLabels: { status: REQUEST_STATUS_LABELS },
  });

  const query = useQuery({
    queryKey: queryKeys.portal.requests(clientId, params.query),
    queryFn: () => listPortalRequests(params.query),
    enabled: clientId.length > 0,
    staleTime: 30_000,
  });

  const requests = query.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="What your firm needs"
        description="Each item below is something your firm has asked you for. Upload straight against it."
      />

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
            key: 'status',
            label: 'Status',
            allLabel: 'Open requests',
            options: DOCUMENT_REQUEST_STATUSES.map((status) => ({
              value: status,
              label: REQUEST_STATUS_LABELS[status],
            })),
          },
        ]}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Your requests did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.isPending ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full" rounded="lg" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        params.hasFilters ? (
          <FilteredEmptyState
            activeFilters={params.activeFilters.map(
              (filter) => `${filter.label}: ${filter.value}`,
            )}
            onClear={params.clearFilters}
          />
        ) : (
          <EmptyState
            icon={<CheckCircle2 size={20} aria-hidden="true" />}
            title="You are all caught up"
            description="Your firm is not waiting on anything from you right now."
          />
        )
      ) : (
        <>
          <ul className="space-y-3">
            {requests.map((request) => (
              <li key={request.id}>
                <PortalRequestCard request={request} onUpload={setUploadFor} />
              </li>
            ))}
          </ul>

          <Pagination
            page={query.data.page}
            limit={query.data.limit}
            total={query.data.total}
            totalPages={query.data.totalPages}
            onPageChange={params.setPage}
            onLimitChange={params.setLimit}
            label="requests"
          />
        </>
      )}

      {uploadFor === null || clientId.length === 0 ? null : (
        <DocumentUploader
          open
          onOpenChange={(next) => {
            if (!next) setUploadFor(null);
          }}
          clientId={clientId}
          documentRequestId={uploadFor.id}
          fixedDocumentType={uploadFor.documentType}
          title={uploadFor.title}
          onUploaded={() => {
            void query.refetch();
          }}
        />
      )}
    </>
  );
}
