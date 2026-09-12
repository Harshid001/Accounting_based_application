import { Printer } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import { ClientPicker } from '@/components/domain/ClientPicker';
import { ExportButton } from '@/components/domain/ExportButton';
import { CATEGORY_LABELS, COMPLIANCE_STATUS_LABELS } from '@/lib/constants';
import { COMPLIANCE_CATEGORIES, COMPLIANCE_STATUSES } from '@/types/enums';
import type { ListParams } from '@/hooks/useListParams';

export const REPORT_TABS = [
  { to: '/reports/compliance', label: 'Compliance status' },
  { to: '/reports/workload', label: 'Workload' },
  { to: '/reports/roster', label: 'Client roster' },
];

export function ReportTabs() {
  return (
    <nav aria-label="Reports" data-print="hide" className="mb-4">
      <ul className="flex flex-wrap gap-1">
        {REPORT_TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'inline-block rounded-md px-3 py-1.5 text-base transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
                  isActive
                    ? 'bg-[var(--fd-accent-subtle-bg)] font-medium text-[var(--fd-accent)]'
                    : 'text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)]',
                )
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface ReportFiltersProps {
  params: ListParams;
  onExport: () => Promise<void>;
  exportDisabled: boolean;
  showComplianceFilters?: boolean;
}

export function ReportFilters({
  params,
  onExport,
  exportDisabled,
  showComplianceFilters = true,
}: ReportFiltersProps) {
  return (
    <Card data-print="hide" className="mb-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44 flex-1">
          <span aria-hidden="true" className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]">
            From
          </span>
          <DatePicker
            ariaLabel="Date range from"
            value={params.filters.dateFrom ?? null}
            onChange={(value) => {
              params.setFilter('dateFrom', value);
            }}
          />
        </div>

        <div className="min-w-44 flex-1">
          <span aria-hidden="true" className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]">To</span>
          <DatePicker
            ariaLabel="Date range to"
            value={params.filters.dateTo ?? null}
            onChange={(value) => {
              params.setFilter('dateTo', value);
            }}
          />
        </div>

        <div className="min-w-44 flex-1">
          <span aria-hidden="true" className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]">
            Client
          </span>
          <ClientPicker
            ariaLabel="Client"
            value={params.filters.client ?? null}
            onChange={(value) => {
              params.setFilter('client', value);
            }}
          />
        </div>

        {showComplianceFilters ? (
          <>
            <div className="min-w-40">
              <span aria-hidden="true" className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]">
                Category
              </span>
              <Select
                ariaLabel="Category"
                value={params.filters.category ?? '__all__'}
                onValueChange={(value) => {
                  params.setFilter('category', value === '__all__' ? null : value);
                }}
                options={[
                  { value: '__all__', label: 'All categories' },
                  ...COMPLIANCE_CATEGORIES.map((category) => ({
                    value: category,
                    label: CATEGORY_LABELS[category],
                  })),
                ]}
              />
            </div>

            <div className="min-w-40">
              <span aria-hidden="true" className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]">
                Status
              </span>
              <Select
                ariaLabel="Status"
                value={params.filters.status ?? '__all__'}
                onValueChange={(value) => {
                  params.setFilter('status', value === '__all__' ? null : value);
                }}
                options={[
                  { value: '__all__', label: 'All statuses' },
                  ...COMPLIANCE_STATUSES.map((status) => ({
                    value: status,
                    label: COMPLIANCE_STATUS_LABELS[status],
                  })),
                ]}
              />
            </div>
          </>
        ) : null}

        <div className="flex items-center gap-2">
          {params.hasFilters ? (
            <Button variant="ghost" size="sm" onClick={params.clearFilters}>
              Clear filters
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Printer size={14} aria-hidden="true" />}
            onClick={() => {
              window.print();
            }}
          >
            Print
          </Button>
          <ExportButton
            onExport={onExport}
            disabled={exportDisabled}
            disabledReason="There is nothing in this view to export."
          />
        </div>
      </div>
    </Card>
  );
}
