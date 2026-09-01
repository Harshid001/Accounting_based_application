import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { IconButton } from '@/components/ui/icon-button';
import { Select } from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS } from '@/lib/constants';

export interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  label?: string;
  className?: string;
}

const pageWindow = (page: number, totalPages: number): number[] => {
  const span = 2;
  const start = Math.max(1, Math.min(page - span, totalPages - span * 2));
  const end = Math.min(totalPages, Math.max(page + span, span * 2 + 1));
  const out: number[] = [];
  for (let index = start; index <= end; index += 1) out.push(index);
  return out;
};

export function Pagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
  label = 'records',
  className,
}: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      data-print="hide"
      className={cn('flex flex-wrap items-center justify-between gap-3 pt-3', className)}
    >
      <p className="numeric text-xs text-[var(--fd-text-tertiary)]">
        {total === 0
          ? `No ${label}`
          : `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)} ${label}`}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--fd-text-tertiary)]">
          <span aria-hidden="true">Per page</span>
          <Select
            size="sm"
            className="w-20"
            ariaLabel="Records per page"
            value={String(limit)}
            onValueChange={(next) => {
              onLimitChange(Number.parseInt(next, 10));
            }}
            options={PAGE_SIZE_OPTIONS.map((option) => ({
              value: String(option),
              label: String(option),
            }))}
          />
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            label="First page"
            size="sm"
            disabled={page <= 1}
            icon={<ChevronFirst size={14} aria-hidden="true" />}
            onClick={() => {
              onPageChange(1);
            }}
          />
          <IconButton
            label="Previous page"
            size="sm"
            disabled={page <= 1}
            icon={<ChevronLeft size={14} aria-hidden="true" />}
            onClick={() => {
              onPageChange(page - 1);
            }}
          />

          <ul className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, totalPages).map((candidate) => (
              <li key={candidate}>
                <button
                  type="button"
                  aria-current={candidate === page ? 'page' : undefined}
                  onClick={() => {
                    onPageChange(candidate);
                  }}
                  className={cn(
                    'numeric h-8 min-w-8 rounded-md px-2 text-xs transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
                    candidate === page
                      ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)]'
                      : 'text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)]',
                  )}
                >
                  {candidate}
                </button>
              </li>
            ))}
          </ul>

          <span className="numeric px-1 text-xs text-[var(--fd-text-tertiary)] sm:hidden">
            {page} / {totalPages}
          </span>

          <IconButton
            label="Next page"
            size="sm"
            disabled={page >= totalPages}
            icon={<ChevronRight size={14} aria-hidden="true" />}
            onClick={() => {
              onPageChange(page + 1);
            }}
          />
          <IconButton
            label="Last page"
            size="sm"
            disabled={page >= totalPages}
            icon={<ChevronLast size={14} aria-hidden="true" />}
            onClick={() => {
              onPageChange(totalPages);
            }}
          />
        </div>
      </div>
    </nav>
  );
}
