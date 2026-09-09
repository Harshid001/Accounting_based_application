import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { formatDate } from '@/lib/date';
import { VoucherStatusPill, VoucherTypeLabel } from '@/routes/books/components/BooksShell';
import type { VoucherView } from '@/types/models';

export interface VoucherTableProps {
  clientId: string;
  items: readonly VoucherView[];
  loading: boolean;
  sort?: { field: string; direction: 'asc' | 'desc' } | null;
  onSortChange?: (field: string) => void;
  emptySlot: ReactNode;
  caption?: string;
}

export function VoucherTable({
  clientId,
  items,
  loading,
  sort,
  onSortChange,
  emptySlot,
  caption = 'Vouchers',
}: VoucherTableProps) {
  const navigate = useNavigate();
  const href = (row: VoucherView) => `/books/vouchers/${row.id}?client=${clientId}`;

  const columns: Array<TableColumn<VoucherView>> = [
    {
      id: 'date',
      header: 'Date',
      sortField: 'date',
      width: '7.5rem',
      cell: (row) => <span className="numeric">{formatDate(row.date)}</span>,
    },
    {
      id: 'voucherNo',
      header: 'Voucher',
      sortField: 'voucherNo',
      width: '11rem',
      cell: (row) => (
        <Link
          to={href(row)}
          className="numeric font-medium text-[var(--fd-accent)] hover:underline"
        >
          {row.voucherNo ?? 'Draft'}
        </Link>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      hideBelow: 'md',
      cell: (row) => <VoucherTypeLabel type={row.type} />,
    },
    {
      id: 'narration',
      header: 'Narration',
      cardLabel: true,
      cell: (row) => (
        <span className="line-clamp-1 text-[var(--fd-text-secondary)]">
          {row.narration ?? row.reference ?? '—'}
        </span>
      ),
    },
    {
      id: 'accounts',
      header: 'Accounts',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="text-xs text-[var(--fd-text-secondary)]">
          {row.lines
            .filter((line) => !line.isDerived)
            .map((line) => line.account?.name ?? '?')
            .slice(0, 3)
            .join(' · ')}
          {row.lines.filter((line) => !line.isDerived).length > 3 ? ' …' : ''}
        </span>
      ),
    },
    {
      id: 'total',
      header: 'Amount',
      sortField: 'totalPaise',
      align: 'right',
      cell: (row) => <span className="numeric font-medium">{row.total.display}</span>,
    },
    { id: 'status', header: 'Status', cell: (row) => <VoucherStatusPill status={row.status} /> },
  ];

  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={items}
      rowKey={(row) => row.id}
      density="compact"
      state={loading ? 'loading' : 'ready'}
      sort={sort ?? null}
      {...(onSortChange ? { onSortChange } : {})}
      emptySlot={emptySlot}
      onRowClick={(row) => {
        void navigate(href(row));
      }}
    />
  );
}
