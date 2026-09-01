import { useQuery } from '@tanstack/react-query';

import { listStaffOptions } from '@/api/users.api';
import { queryKeys } from '@/api/queryKeys';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';
import { ROLE_LABELS } from '@/lib/constants';
import type { StaffOption } from '@/types/models';

export const useStaffOptions = (): { options: StaffOption[]; loading: boolean } => {
  const query = useQuery({
    queryKey: queryKeys.users.staff,
    queryFn: listStaffOptions,
    staleTime: 5 * 60_000,
  });
  return { options: query.data?.items ?? [], loading: query.isPending };
};

export interface StaffPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string | undefined;
  invalid?: boolean;
  disabled?: boolean;
  restrictTo?: readonly string[];
  placeholder?: string;
  allowClear?: boolean;
}

export function StaffPicker({
  value,
  onChange,
  id,
  ariaLabel = 'Staff member',
  ariaDescribedBy,
  invalid = false,
  disabled = false,
  restrictTo,
  placeholder = 'Choose a staff member',
  allowClear = true,
}: StaffPickerProps) {
  const { options, loading } = useStaffOptions();
  const allowed =
    restrictTo === undefined ? options : options.filter((entry) => restrictTo.includes(entry.id));

  return (
    <Combobox
      value={value}
      onChange={onChange}
      loading={loading}
      options={allowed.map((entry) => ({
        value: entry.id,
        label: entry.name,
        hint: ROLE_LABELS[entry.role],
      }))}
      placeholder={placeholder}
      searchPlaceholder="Search staff"
      emptyLabel="No staff member matches that search"
      allowClear={allowClear}
      disabled={disabled}
      invalid={invalid}
      {...(id === undefined ? {} : { id })}
      ariaLabel={ariaLabel}
      ariaDescribedBy={ariaDescribedBy}
    />
  );
}

export interface StaffMultiPickerProps {
  value: readonly string[];
  onChange: (value: string[]) => void;
  legend: string;
  disabled?: boolean;
}

export function StaffMultiPicker({ value, onChange, legend, disabled = false }: StaffMultiPickerProps) {
  const { options, loading } = useStaffOptions();

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <p className="text-xs text-[var(--fd-text-tertiary)]">
        No active staff accounts exist yet. Promote someone from Settings, Users first.
      </p>
    );
  }

  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="mb-2 text-xs font-medium text-[var(--fd-text-secondary)]">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((entry) => (
          <Checkbox
            key={entry.id}
            checked={value.includes(entry.id)}
            disabled={disabled}
            label={entry.name}
            description={ROLE_LABELS[entry.role]}
            onCheckedChange={(checked) => {
              onChange(
                checked ? [...value, entry.id] : value.filter((candidate) => candidate !== entry.id),
              );
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
