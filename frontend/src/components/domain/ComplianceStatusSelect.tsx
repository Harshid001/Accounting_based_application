import { COMPLIANCE_STATUS_LABELS } from '@/lib/constants';
import { Select } from '@/components/ui/select';
import { COMPLIANCE_STATUSES, COMPLIANCE_TRANSITIONS } from '@/types/enums';
import type { ComplianceStatus } from '@/types/enums';

export const complianceStatusOptions = COMPLIANCE_STATUSES.map((status) => ({
  value: status,
  label: COMPLIANCE_STATUS_LABELS[status],
}));

export interface ComplianceStatusSelectProps {
  value: ComplianceStatus;
  onChange: (value: ComplianceStatus) => void;
  from?: ComplianceStatus;
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string | undefined;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function ComplianceStatusSelect({
  value,
  onChange,
  from,
  id,
  ariaLabel = 'Status',
  ariaDescribedBy,
  disabled = false,
  size = 'md',
}: ComplianceStatusSelectProps) {
  const allowed = from === undefined ? COMPLIANCE_STATUSES : COMPLIANCE_TRANSITIONS[from];

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        onChange(next as ComplianceStatus);
      }}
      options={complianceStatusOptions.map((option) => ({
        ...option,
        disabled: !allowed.includes(option.value) && option.value !== from,
      }))}
      {...(id === undefined ? {} : { id })}
      ariaLabel={ariaLabel}
      ariaDescribedBy={ariaDescribedBy}
      disabled={disabled}
      size={size}
    />
  );
}
