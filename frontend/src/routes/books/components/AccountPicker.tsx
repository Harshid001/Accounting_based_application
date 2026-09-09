import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { listAccounts } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Combobox } from '@/components/ui/combobox';
import { useDebounce } from '@/hooks/useDebounce';
import { ACCOUNT_TYPE_LABELS, SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import type { AccountType } from '@/types/enums';

export interface AccountPickerProps {
  clientId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string | undefined;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  allowClear?: boolean;
  /** Hide engine-managed duty accounts (they cannot be posted to directly). */
  excludeSystem?: boolean;
  type?: AccountType;
}

export function AccountPicker({
  clientId,
  value,
  onChange,
  id,
  ariaLabel = 'Account',
  ariaDescribedBy,
  invalid = false,
  disabled = false,
  placeholder = 'Choose an account',
  allowClear = true,
  excludeSystem = false,
  type,
}: AccountPickerProps) {
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, SEARCH_DEBOUNCE_MS);

  const params = {
    client: clientId,
    page: 1,
    limit: 50,
    sort: 'code:asc',
    ...(type === undefined ? {} : { type }),
    ...(debounced.trim().length > 0 ? { q: debounced } : {}),
  };
  const query = useQuery({
    queryKey: queryKeys.books.accounts.list(params),
    queryFn: ({ signal }) => listAccounts(params, signal),
    staleTime: 60_000,
    enabled: clientId.length > 0,
  });

  const options = (query.data?.items ?? [])
    .filter((account) => !(excludeSystem && account.isSystem))
    .map((account) => ({
      value: account.id,
      label: `${account.code} · ${account.name}`,
      hint: ACCOUNT_TYPE_LABELS[account.type],
    }));

  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      loading={query.isFetching}
      onSearchChange={setTerm}
      placeholder={placeholder}
      searchPlaceholder="Search by code or name"
      emptyLabel="No account matches that search"
      allowClear={allowClear}
      disabled={disabled || clientId.length === 0}
      invalid={invalid}
      {...(id === undefined ? {} : { id })}
      ariaLabel={ariaLabel}
      ariaDescribedBy={ariaDescribedBy}
    />
  );
}
