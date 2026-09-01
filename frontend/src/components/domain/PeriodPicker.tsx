import { PERIOD_TYPE_LABELS } from '@/lib/constants';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { PERIOD_TYPES } from '@/types/enums';
import type { PeriodType } from '@/types/enums';

const HINTS: Record<PeriodType, string> = {
  month: 'Any date inside the month you are filing for.',
  quarter: 'Any date inside the quarter you are filing for.',
  half_year: 'Any date inside the half year you are filing for.',
  financial_year: 'Any date inside the April–March year you are filing for.',
};

export interface PeriodPickerProps {
  periodType: PeriodType;
  anchor: string | null;
  onPeriodTypeChange: (value: PeriodType) => void;
  onAnchorChange: (value: string | null) => void;
  anchorError?: string | undefined;
  disabled?: boolean;
}

export function PeriodPicker({
  periodType,
  anchor,
  onPeriodTypeChange,
  onAnchorChange,
  anchorError,
  disabled = false,
}: PeriodPickerProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Period type" required>
        {({ inputId }) => (
          <Select
            id={inputId}
            value={periodType}
            disabled={disabled}
            onValueChange={(value) => {
              onPeriodTypeChange(value as PeriodType);
            }}
            options={PERIOD_TYPES.map((type) => ({
              value: type,
              label: PERIOD_TYPE_LABELS[type],
            }))}
          />
        )}
      </FormField>

      <FormField
        label="Date inside the period"
        required
        helper={HINTS[periodType]}
        error={anchorError}
      >
        {({ inputId, describedBy, invalid }) => (
          <DatePicker
            id={inputId}
            value={anchor}
            onChange={onAnchorChange}
            disabled={disabled}
            invalid={invalid}
            ariaDescribedBy={describedBy}
            ariaLabel="Date inside the period"
          />
        )}
      </FormField>
    </div>
  );
}
