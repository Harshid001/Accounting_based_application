import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/skeleton';

export type SortDirection = 'asc' | 'desc';
export type Density = 'compact' | 'comfortable';

export interface TableColumn<Row> {
  id: string;
  header: string;
  sortField?: string;
  align?: 'left' | 'right';
  width?: string;
  hideBelow?: 'sm' | 'md' | 'lg';
  cell: (row: Row) => ReactNode;
  cardLabel?: boolean;
}

export interface TableProps<Row> {
  columns: ReadonlyArray<TableColumn<Row>>;
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  caption: string;
  density?: Density;
  sort?: { field: string; direction: SortDirection } | null;
  onSortChange?: (field: string) => void;
  rowActions?: (row: Row) => ReactNode;
  onRowClick?: (row: Row) => void;
  state?: 'loading' | 'ready';
  skeletonRows?: number;
  emptySlot?: ReactNode;
  className?: string;
}

const HIDE_BELOW: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  density = 'compact',
  sort,
  onSortChange,
  rowActions,
  onRowClick,
  state = 'ready',
  skeletonRows = 6,
  emptySlot,
  className,
}: TableProps<Row>) {
  const cellPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const rowHeight = density === 'compact' ? 'h-10' : 'h-13';
  const loading = state === 'loading';
  const showEmpty = !loading && rows.length === 0 && emptySlot !== undefined;

  return (
    <div className={cn('w-full', className)}>
      <div className="hidden overflow-x-auto rounded-lg border border-[var(--fd-border-subtle)] md:block">
        <table className="w-full border-collapse text-left" aria-busy={loading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-[var(--fd-surface-2)]">
            <tr>
              {columns.map((column) => {
                const activeSort =
                  sort !== null && sort !== undefined && sort.field === column.sortField
                    ? sort
                    : null;
                const ariaSort =
                  activeSort === null
                    ? ('none' as const)
                    : activeSort.direction === 'asc'
                      ? ('ascending' as const)
                      : ('descending' as const);
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={column.sortField === undefined ? undefined : ariaSort}
                    style={column.width === undefined ? undefined : { width: column.width }}
                    className={cn(
                      'text-2xs border-b border-[var(--fd-border)] font-semibold tracking-wide',
                      'text-[var(--fd-text-secondary)] uppercase',
                      cellPadding,
                      column.align === 'right' && 'text-right',
                      column.hideBelow === undefined ? '' : HIDE_BELOW[column.hideBelow],
                    )}
                  >
                    {column.sortField !== undefined && onSortChange !== undefined ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSortChange(column.sortField ?? column.id);
                        }}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-sm hover:text-[var(--fd-text-primary)]',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
                        )}
                      >
                        {column.header}
                        {activeSort === null ? (
                          <ChevronsUpDown size={12} aria-hidden="true" className="opacity-45" />
                        ) : activeSort.direction === 'asc' ? (
                          <ChevronUp size={12} aria-hidden="true" />
                        ) : (
                          <ChevronDown size={12} aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {rowActions === undefined ? null : (
                <th scope="col" className={cn('border-b border-[var(--fd-border)]', cellPadding)}>
                  <span className="sr-only">Row actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <tr key={`skeleton-${index}`} className={rowHeight}>
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          'border-b border-[var(--fd-border-subtle)]',
                          cellPadding,
                          column.hideBelow === undefined ? '' : HIDE_BELOW[column.hideBelow],
                        )}
                      >
                        <Skeleton className="h-3 w-full max-w-32" />
                      </td>
                    ))}
                    {rowActions === undefined ? null : (
                      <td className={cn('border-b border-[var(--fd-border-subtle)]', cellPadding)} />
                    )}
                  </tr>
                ))
              : showEmpty
                ? null
                : rows.map((row) => (
                    <tr
                      key={rowKey(row)}
                      className={cn(
                        rowHeight,
                        'transition-colors hover:bg-[var(--fd-surface-3)]',
                        onRowClick === undefined ? '' : 'cursor-pointer',
                      )}
                      onClick={
                        onRowClick === undefined
                          ? undefined
                          : (event) => {
                              const target = event.target as HTMLElement;
                              if (target.closest('a,button,[role="menuitem"],input') !== null) {
                                return;
                              }
                              onRowClick(row);
                            }
                      }
                    >
                      {columns.map((column) => (
                        <td
                          key={column.id}
                          className={cn(
                            'border-b border-[var(--fd-border-subtle)] align-middle',
                            cellPadding,
                            column.align === 'right' && 'text-right',
                            column.hideBelow === undefined ? '' : HIDE_BELOW[column.hideBelow],
                          )}
                        >
                          {column.cell(row)}
                        </td>
                      ))}
                      {rowActions === undefined ? null : (
                        <td
                          className={cn(
                            'border-b border-[var(--fd-border-subtle)] text-right',
                            cellPadding,
                          )}
                        >
                          {rowActions(row)}
                        </td>
                      )}
                    </tr>
                  ))}
          </tbody>
        </table>
        {showEmpty ? <div className="border-t border-[var(--fd-border-subtle)]">{emptySlot}</div> : null}
      </div>

      <div className="space-y-2 md:hidden" aria-busy={loading || undefined}>
        {loading ? (
          Array.from({ length: Math.min(skeletonRows, 4) }, (_, index) => (
            <div
              key={`card-skeleton-${index}`}
              className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-3"
            >
              <Skeleton className="mb-2 h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))
        ) : rows.length === 0 ? (
          (emptySlot ?? null)
        ) : (
          rows.map((row) => (
            <div
              key={rowKey(row)}
              className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  {columns
                    .filter((column) => column.cardLabel !== false)
                    .map((column) => (
                      <div key={column.id} className="flex flex-wrap items-baseline gap-2">
                        <span className="text-2xs w-24 shrink-0 text-[var(--fd-text-tertiary)]">
                          {column.header}
                        </span>
                        <span className="min-w-0 text-base text-[var(--fd-text-primary)]">
                          {column.cell(row)}
                        </span>
                      </div>
                    ))}
                </div>
                {rowActions === undefined ? null : <div className="shrink-0">{rowActions(row)}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
