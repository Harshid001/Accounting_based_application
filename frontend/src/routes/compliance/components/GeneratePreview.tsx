import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/date';
import { pluralise } from '@/lib/format';
import type { GeneratePreview as Preview, GeneratePreviewRow, GenerateSkipRow } from '@/types/models';

const CREATE_COLUMNS: Array<TableColumn<GeneratePreviewRow>> = [
  { id: 'client', header: 'Client', cell: (row) => row.clientName },
  { id: 'filing', header: 'Filing', cell: (row) => row.complianceTypeName },
  { id: 'period', header: 'Period', cell: (row) => row.periodLabel },
  {
    id: 'due',
    header: 'Due',
    align: 'right',
    cell: (row) => <span className="numeric">{formatDate(row.dueDate)}</span>,
  },
];

const SKIP_COLUMNS: Array<TableColumn<GenerateSkipRow>> = [
  { id: 'client', header: 'Client', cell: (row) => row.clientName },
  { id: 'filing', header: 'Filing', cell: (row) => row.complianceTypeName },
  { id: 'period', header: 'Period', cell: (row) => row.periodLabel },
  {
    id: 'reason',
    header: 'Skipped because',
    cell: (row) => <span className="text-[var(--fd-text-tertiary)]">{row.reason}</span>,
  },
];

export function GeneratePreview({ preview }: { preview: Preview }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Will be created"
          description={`${pluralise(preview.willCreate.length, 'filing')} will be added when you commit.`}
        />
        <DataTable
          caption="Filings that will be created"
          columns={CREATE_COLUMNS}
          rows={preview.willCreate}
          rowKey={(row) => `${row.clientId}-${row.periodLabel}`}
          emptySlot={
            <EmptyState
              title="Nothing new to create"
              description="Every period in this range already exists for the clients you chose."
            />
          }
        />
      </Card>

      {preview.willSkip.length === 0 ? null : (
        <Card>
          <CardHeader
            title="Will be skipped"
            description={`${pluralise(preview.willSkip.length, 'filing')} already exists or does not apply.`}
          />
          <DataTable
            caption="Filings that will be skipped"
            columns={SKIP_COLUMNS}
            rows={preview.willSkip}
            rowKey={(row) => `${row.clientId}-${row.periodLabel}-${row.reason}`}
            emptySlot={null}
          />
        </Card>
      )}
    </div>
  );
}
