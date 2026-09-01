import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { listClients } from '@/api/clients.api';
import { queryKeys } from '@/api/queryKeys';
import { Combobox } from '@/components/ui/combobox';
import { useDebounce } from '@/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

export interface ClientPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string | undefined;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  allowClear?: boolean;
}

export function ClientPicker({
  value,
  onChange,
  id,
  ariaLabel = 'Client',
  ariaDescribedBy,
  invalid = false,
  disabled = false,
  placeholder = 'Choose a client',
  allowClear = true,
}: ClientPickerProps) {
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, SEARCH_DEBOUNCE_MS);

  const params = { page: 1, limit: 25, ...(debounced.trim().length > 0 ? { q: debounced } : {}) };
  const query = useQuery({
    queryKey: queryKeys.clients.list(params),
    queryFn: ({ signal }) => listClients(params, signal),
    staleTime: 60_000,
  });

  const options = (query.data?.items ?? []).map((client) => ({
    value: client.id,
    label: client.displayName,
    ...(client.pan === null ? {} : { hint: client.pan }),
  }));

  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      loading={query.isFetching}
      onSearchChange={setTerm}
      placeholder={placeholder}
      searchPlaceholder="Search by name, PAN or GSTIN"
      emptyLabel="No client matches that search"
      allowClear={allowClear}
      disabled={disabled}
      invalid={invalid}
      {...(id === undefined ? {} : { id })}
      ariaLabel={ariaLabel}
      ariaDescribedBy={ariaDescribedBy}
    />
  );
}
