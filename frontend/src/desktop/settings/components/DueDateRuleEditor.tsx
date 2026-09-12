import type { UseFormReturn } from 'react-hook-form';

import { FieldRow, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SEEDED_DUE_DATE_HINT } from '@/lib/constants';
import { DUE_DATE_RULE_KINDS } from '@/types/enums';
import type { DueDateRuleKind } from '@/types/enums';
import type { ComplianceTypeFormValues } from '@/schemas/complianceType.schema';
import type { DueDateRule } from '@/types/models';

const KIND_LABELS: Record<DueDateRuleKind, string> = {
  day_of_following_month: 'Day N of a following month',
  days_after_period_end: 'N days after the period ends',
  fixed_day_month_after_period: 'A fixed day and month after the period',
};

const ordinal = (day: number): string => {
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${day}${suffix}`;
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const describeRule = (rule: DueDateRule | null): string => {
  if (rule === null) return 'No rule';
  switch (rule.kind) {
    case 'day_of_following_month':
      return `${ordinal(rule.day)} of the month ${rule.monthsAfter === 1 ? 'after' : `${rule.monthsAfter} months after`} the period`;
    case 'days_after_period_end':
      return `${rule.days} days after the period ends`;
    case 'fixed_day_month_after_period':
      return `${ordinal(rule.day)} ${MONTHS[rule.month - 1] ?? ''}${rule.yearsAfter === 1 ? ' the following year' : ''}`;
  }
};

export function DueDateRuleEditor({ form }: { form: UseFormReturn<ComplianceTypeFormValues> }) {
  const kind = form.watch('ruleKind');
  const errors = form.formState.errors;

  return (
    <div className="space-y-4">
      <FormField label="Rule shape" required helper={SEEDED_DUE_DATE_HINT}>
        {({ inputId, describedBy }) => (
          <Select
            id={inputId}
            ariaLabel="Rule shape"
            ariaDescribedBy={describedBy}
            value={kind}
            onValueChange={(value) => {
              form.setValue('ruleKind', value as DueDateRuleKind, { shouldDirty: true });
            }}
            options={DUE_DATE_RULE_KINDS.map((value) => ({
              value,
              label: KIND_LABELS[value],
            }))}
          />
        )}
      </FormField>

      {kind === 'day_of_following_month' ? (
        <FieldRow>
          <FormField label="Day of the month" required error={errors.ruleDay?.message}>
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                inputMode="numeric"
                className="numeric"
                invalid={invalid}
                aria-describedby={describedBy}
                {...form.register('ruleDay')}
              />
            )}
          </FormField>
          <FormField
            label="Months after the period"
            required
            helper="1 means the month straight after the period ends."
            error={errors.ruleMonthsAfter?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                inputMode="numeric"
                className="numeric"
                invalid={invalid}
                aria-describedby={describedBy}
                {...form.register('ruleMonthsAfter')}
              />
            )}
          </FormField>
        </FieldRow>
      ) : null}

      {kind === 'days_after_period_end' ? (
        <FormField label="Days after the period ends" required error={errors.ruleDays?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              inputMode="numeric"
              className="numeric"
              invalid={invalid}
              aria-describedby={describedBy}
              {...form.register('ruleDays')}
            />
          )}
        </FormField>
      ) : null}

      {kind === 'fixed_day_month_after_period' ? (
        <>
          <FieldRow>
            <FormField label="Day" required error={errors.ruleDay?.message}>
              {({ inputId, describedBy, invalid }) => (
                <Input
                  id={inputId}
                  inputMode="numeric"
                  className="numeric"
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('ruleDay')}
                />
              )}
            </FormField>
            <FormField label="Month, 1 to 12" required error={errors.ruleMonth?.message}>
              {({ inputId, describedBy, invalid }) => (
                <Input
                  id={inputId}
                  inputMode="numeric"
                  className="numeric"
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('ruleMonth')}
                />
              )}
            </FormField>
          </FieldRow>
          <FormField
            label="Years after the period"
            required
            helper="0 for the same year, 1 for the next."
            error={errors.ruleYearsAfter?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                inputMode="numeric"
                className="numeric"
                invalid={invalid}
                aria-describedby={describedBy}
                {...form.register('ruleYearsAfter')}
              />
            )}
          </FormField>
        </>
      ) : null}

      <p className="rounded-md border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-3 py-2 text-xs text-[var(--fd-text-secondary)]">
        A day past the end of the target month clamps to the last day of that month.
      </p>
    </div>
  );
}
