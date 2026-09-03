import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck,
  FileText,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useState } from 'react';

import { listDocuments } from '@/api/documents.api';
import { listPortalRequests } from '@/api/portal.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ProgressBar } from '@/components/ui/progress-bar';
import { DocumentList } from '@/components/domain/DocumentList';
import { DocumentUploader } from '@/components/domain/DocumentUploader';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { useActiveClient } from '@/context/ActiveClientContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { DOCUMENT_TYPES } from '@/types/enums';
import type { DocumentType } from '@/types/enums';
import type { PortalDocumentRequestView } from '@/types/models';

const ESSENTIAL_KYC_DOCS: Array<{
  id: string;
  name: string;
  type: DocumentType;
  description: string;
}> = [
  { id: 'pan', name: 'PAN Card Copy', type: 'tax_document', description: 'Entity or Authorized Signatory PAN' },
  { id: 'gst', name: 'GST Certificate (REG-06)', type: 'tax_document', description: 'Official 3-page registration certificate' },
  { id: 'bank', name: 'Bank Statement / Cancelled Cheque', type: 'bank_statement', description: 'Recent statement or cheque for verification' },
  { id: 'legal', name: 'Incorporation / Deed / MSME', type: 'audit_document', description: 'COI, LLP agreement, or partnership deed' },
  { id: 'financials', name: 'Prior Year Return / Financials', type: 'income_proof', description: 'Last filed ITR-V or Balance Sheet' },
];

export function PortalDocuments() {
  usePageTitle('Your documents');
  const { activeClientId } = useActiveClient();
  const clientId = activeClientId ?? '';

  const [uploadOpen, setUploadOpen] = useState(false);
  const [fixedType, setFixedType] = useState<DocumentType | undefined>(undefined);
  const [modalTitle, setModalTitle] = useState('Send your firm a document');
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);

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

  const requestsQuery = useQuery({
    queryKey: queryKeys.portal.requests(clientId, { status: 'open' }),
    queryFn: () => listPortalRequests({ status: 'open' }),
    enabled: clientId.length > 0,
    staleTime: 30_000,
  });

  const openGeneralUpload = () => {
    setFixedType(undefined);
    setTargetRequestId(null);
    setModalTitle('Send your firm a document');
    setUploadOpen(true);
  };

  const openForChecklist = (type: DocumentType, docName: string) => {
    setFixedType(type);
    setTargetRequestId(null);
    setModalTitle(`Upload ${docName}`);
    setUploadOpen(true);
  };

  const openForRequest = (req: PortalDocumentRequestView) => {
    setFixedType(req.documentType);
    setTargetRequestId(req.id);
    setModalTitle(`Fulfill Request: ${req.title}`);
    setUploadOpen(true);
  };

  const uploadedDocs = query.data?.items ?? [];
  const openRequests = requestsQuery.data?.items ?? [];

  // Calculate KYC checklist items uploaded
  const completedKycCount = ESSENTIAL_KYC_DOCS.filter((item) =>
    uploadedDocs.some((d) => d.documentType === item.type),
  ).length;

  return (
    <>
      <PageHeader
        title="Your documents"
        description="Upload onboarding KYC proofs, invoices, bank statements, and tax files for your accounting team."
        actions={
          <Button
            variant="primary"
            iconLeft={<Upload size={15} aria-hidden="true" />}
            onClick={openGeneralUpload}
          >
            Upload a document
          </Button>
        }
      />

      {/* Open Document Requests from Firm Banner */}
      {openRequests.length > 0 && (
        <div className="mb-6 rounded-xl border border-[var(--fd-status-waiting)]/40 bg-[var(--fd-status-waiting-bg)] p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-[var(--fd-status-waiting)]" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--fd-text-primary)]">
                  Action Required: Your firm requested {openRequests.length} document{openRequests.length > 1 ? 's' : ''}
                </h2>
                <span className="rounded-full bg-[var(--fd-status-waiting)]/20 px-2 py-0.5 text-2xs font-semibold text-[var(--fd-status-waiting)]">
                  Pending
                </span>
              </div>
              <p className="text-xs text-[var(--fd-text-secondary)]">
                Your accountants need these documents to proceed with compliance filings:
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {openRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-3"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate text-xs font-semibold text-[var(--fd-text-primary)]">
                        {req.title}
                      </div>
                      <div className="text-2xs text-[var(--fd-text-tertiary)]">
                        {DOCUMENT_TYPE_LABELS[req.documentType]}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => openForRequest(req)}
                      iconLeft={<Upload size={13} />}
                    >
                      Upload Now
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Essential KYC & Onboarding Documents Checklist */}
      <div className="mb-6 rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-[var(--fd-accent)]" />
              <h2 className="text-sm font-semibold text-[var(--fd-text-primary)]">
                Onboarding & Essential Compliance Records
              </h2>
            </div>
            <p className="text-xs text-[var(--fd-text-secondary)]">
              Core documents required by Indian tax authorities for filings and statutory audits.
            </p>
          </div>
          <div className="w-full sm:w-48">
            <ProgressBar
              value={completedKycCount}
              max={ESSENTIAL_KYC_DOCS.length}
              label="Essential records completion"
              showValue
              tone={completedKycCount === ESSENTIAL_KYC_DOCS.length ? 'done' : 'accent'}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {ESSENTIAL_KYC_DOCS.map((doc) => {
            const hasUploaded = uploadedDocs.some((d) => d.documentType === doc.type);
            return (
              <div
                key={doc.id}
                className={`flex items-start justify-between rounded-lg border p-3 transition-colors ${
                  hasUploaded
                    ? 'border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/60'
                    : 'border-[var(--fd-border)] bg-[var(--fd-surface-2)]'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    {hasUploaded ? (
                      <CheckCircle2 size={15} className="shrink-0 text-[var(--fd-status-done)]" />
                    ) : (
                      <FileCheck size={15} className="shrink-0 text-[var(--fd-text-tertiary)]" />
                    )}
                    <span className="truncate text-xs font-semibold text-[var(--fd-text-primary)]">
                      {doc.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-2xs text-[var(--fd-text-tertiary)]">{doc.description}</p>
                </div>

                {hasUploaded ? (
                  <span className="shrink-0 rounded bg-[var(--fd-status-done-bg)] px-2 py-0.5 text-3xs font-semibold text-[var(--fd-status-done)] uppercase">
                    On file
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openForChecklist(doc.type, doc.name)}
                    className="shrink-0 text-xs"
                  >
                    Upload
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
                      onClick={openGeneralUpload}
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
          documentRequestId={targetRequestId}
          fixedDocumentType={fixedType}
          title={modalTitle}
          onUploaded={() => {
            void query.refetch();
            void requestsQuery.refetch();
          }}
        />
      )}
    </>
  );
}

