import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';

interface Row {
  id: string;
  name: string;
  status: string;
}

const ROWS: Row[] = [
  { id: '1', name: 'Acme Traders', status: 'Active' },
  { id: '2', name: 'Bharat Textiles', status: 'Onboarding' },
];

const COLUMNS: Array<TableColumn<Row>> = [
  { id: 'name', header: 'Client', sortField: 'displayName', cell: (row) => row.name },
  { id: 'status', header: 'Status', sortField: 'status', cell: (row) => row.status },
];

const renderTable = (props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) =>
  render(
    <DataTable<Row>
      caption="Clients"
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(row) => row.id}
      {...props}
    />,
  );

describe('DataTable', () => {
  it('uses a real table with a caption and scoped column headers', () => {
    renderTable();
    const table = screen.getByRole('table', { name: 'Clients' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    for (const header of headers) {
      expect(header).toHaveAttribute('scope', 'col');
    }
  });

  it('reports aria-sort as none until a column is sorted', () => {
    renderTable();
    for (const header of screen.getAllByRole('columnheader')) {
      expect(header).toHaveAttribute('aria-sort', 'none');
    }
  });

  it('reports the direction on the sorted column only', () => {
    renderTable({ sort: { field: 'displayName', direction: 'desc' }, onSortChange: vi.fn() });
    const [client, status] = screen.getAllByRole('columnheader');
    expect(client).toHaveAttribute('aria-sort', 'descending');
    expect(status).toHaveAttribute('aria-sort', 'none');
  });

  it('asks for a new sort field when a sortable header is activated', async () => {
    const onSortChange = vi.fn();
    renderTable({ sort: null, onSortChange });

    await userEvent.click(screen.getByRole('button', { name: /Status/ }));
    expect(onSortChange).toHaveBeenCalledWith('status');
  });

  it('keeps the header visible while loading and shows no data rows', () => {
    renderTable({ state: 'loading', rows: [], skeletonRows: 3 });

    const table = screen.getByRole('table', { name: 'Clients' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
    expect(table).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Acme Traders')).not.toBeInTheDocument();
  });

  it('renders the empty slot inside the table region when there are no rows', () => {
    renderTable({
      rows: [],
      emptySlot: <EmptyState title="No clients yet" description="Add the first client record." />,
    });

    expect(screen.getAllByText('No clients yet').length).toBeGreaterThan(0);
    expect(screen.getByRole('table', { name: 'Clients' })).toBeInTheDocument();
  });

  it('renders a card for every row on narrow viewports as well as the table', () => {
    renderTable();
    expect(screen.getAllByText('Acme Traders')).toHaveLength(2);
  });

  it('opens a row when it is clicked, but not when a control inside it is', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable<Row>
        caption="Clients"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
        rowActions={(row) => <button type="button">Pin {row.name}</button>}
      />,
    );

    const table = screen.getByRole('table', { name: 'Clients' });
    const cell = within(table).getByRole('cell', { name: 'Acme Traders' });
    await userEvent.click(cell);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);

    onRowClick.mockClear();
    await userEvent.click(within(table).getByRole('button', { name: 'Pin Acme Traders' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
