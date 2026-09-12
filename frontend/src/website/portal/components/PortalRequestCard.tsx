import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OverdueBadge, RequestStatusPill } from '@/components/domain/StatusPills';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { formatDate, relativeDeadline } from '@/lib/date';
import type { PortalDocumentRequestView } from '@/types/models';

export interface PortalRequestCardProps {
  request: PortalDocumentRequestView;
  onUpload: (request: PortalDocumentRequestView) => void;
}

export function PortalRequestCard({ request, onUpload }: PortalRequestCardProps) {
  return (
    <Card
      className={
        request.isOverdue
          ? 'border-[var(--fd-status-danger)] bg-[var(--fd-status-danger-bg)]'
          : undefined
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--fd-text-primary)]">{request.title}</h2>
          {request.description === null ? null : (
            <p className="mt-1 text-md text-[var(--fd-text-secondary)]">{request.description}</p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--fd-text-tertiary)]">
            <RequestStatusPill status={request.status} />
            <OverdueBadge overdue={request.isOverdue} />
            <span className="numeric">
              {request.dueDate === null
                ? 'No date given'
                : `Needed by ${formatDate(request.dueDate)}`}
            </span>
            {request.dueDate === null ? null : <span>{relativeDeadline(request.dueDate)}</span>}
            <span>Type: {DOCUMENT_TYPE_LABELS[request.documentType]}</span>
          </p>
        </div>

        {request.status === 'open' ? (
          <Button
            variant="primary"
            iconLeft={<Upload size={15} aria-hidden="true" />}
            onClick={() => {
              onUpload(request);
            }}
          >
            Upload this
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
