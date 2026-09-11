import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { SelectOption } from '@/components/ui/select';
import { useDebounce } from '@/hooks/useDebounce';
import type { ActiveFilter } from '@/hooks/useListParams';

export interface FilterDefinition {
  key: string;
  label: string;
  options: readonly SelectOption[];
  allLabel?: string;
}

export interface FilterPreset {
  id: string;
  label: string;
  icon?: ReactNode;
  active: boolean;
  onClick: () => void;
  count?: number;
}

export interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: readonly FilterDefinition[];
  values: Record<string, string>;
  onFilterChange: (key: string, value: string | null) => void;
  activeFilters: readonly ActiveFilter[];
  onClear: () => void;
  extra?: ReactNode;
  showSearch?: boolean;
  className?: string;
  presets?: readonly FilterPreset[];
}

const ALL = '__all__';

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search',
  filters,
  values,
  onFilterChange,
  activeFilters,
  onClear,
  extra,
  showSearch = true,
  className,
  presets,
}: FilterBarProps) {
  const [draft, setDraft] = useState(search);
  const [lastSearch, setLastSearch] = useState(search);
  const debounced = useDebounce(draft, SEARCH_DEBOUNCE_MS);

  if (lastSearch !== search) {
    setLastSearch(search);
    setDraft(search);
  }

  useEffect(() => {
    if (debounced !== search) onSearchChange(debounced);
  }, [debounced, search, onSearchChange]);

  return (
    <div data-slot="filter-bar" data-print="hide" className={cn('mb-4 space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {showSearch ? (
          <div className="w-full min-w-0 flex-1 sm:w-auto sm:min-w-56">
            <Input
              type="search"
              value={draft}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              prefix={<Search size={14} aria-hidden="true" />}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
            />
          </div>
        ) : null}

        {filters.map((filter) => (
          <Select
            key={filter.key}
            className="w-full sm:w-44"
            size="md"
            ariaLabel={filter.label}
            value={values[filter.key] ?? ALL}
            onValueChange={(next) => {
              onFilterChange(filter.key, next === ALL ? null : next);
            }}
            options={[
              { value: ALL, label: filter.allLabel ?? `All ${filter.label.toLowerCase()}` },
              ...filter.options,
            ]}
          />
        ))}

        {extra}
      </div>

      {presets && presets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5" data-slot="filter-presets">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={preset.onClick}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all shadow-2xs cursor-pointer',
                'focus-visible:outline-2 focus-visible:outline-[var(--fd-focus-ring)] focus-visible:outline-offset-1',
                preset.active
                  ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] border border-[var(--fd-accent)] shadow-xs font-semibold'
                  : 'bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)] border border-[var(--fd-border)] hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]',
              )}
            >
              {preset.icon}
              <span>{preset.label}</span>
              {preset.count !== undefined && (
                <span
                  className={cn(
                    'ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold',
                    preset.active ? 'bg-[var(--fd-accent)]/25 text-[var(--fd-accent-contrast)]' : 'bg-[var(--fd-surface-3)] text-[var(--fd-text-tertiary)]',
                  )}
                >
                  {preset.count}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Chip
              key={filter.key}
              label={filter.label}
              value={filter.value}
              removeLabel={`Remove the ${filter.label} filter`}
              onRemove={() => {
                onFilterChange(filter.key, null);
              }}
            />
          ))}
          <Button variant="link" size="sm" onClick={onClear}>
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
