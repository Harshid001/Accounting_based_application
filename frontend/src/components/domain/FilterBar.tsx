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
          <div className="min-w-56 flex-1">
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
            className="w-44"
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
