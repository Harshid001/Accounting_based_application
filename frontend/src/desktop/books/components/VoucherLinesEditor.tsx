import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatPaise } from '@/lib/format';
import { AccountPicker } from '@/desktop/books/components/AccountPicker';
import { emptyLine, lineTotals, projectTotalsWithDuties } from '@/schemas/books.schema';
import type { VoucherFormValues } from '@/schemas/books.schema';

export interface VoucherLinesEditorProps {
  clientId: string;
  control: Control<VoucherFormValues>;
  register: UseFormRegister<VoucherFormValues>;
  errors: FieldErrors<VoucherFormValues>;
  disabled?: boolean;
}

const fieldError = (
  errors: FieldErrors<VoucherFormValues>,
  index: number,
  key: keyof NonNullable<VoucherFormValues['lines'][number]>,
): string | undefined => errors.lines?.[index]?.[key]?.message;

export function VoucherLinesEditor({
  clientId,
  control,
  register,
  errors,
  disabled = false,
}: VoucherLinesEditorProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch({ control, name: 'lines' });
  const totals = lineTotals(lines);
  const diff = totals.debit - totals.credit;
  const projected = projectTotalsWithDuties(lines);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const linesError = errors.lines?.message ?? errors.lines?.root?.message;

  return (
    <div className="space-y-3">
      <div
        role="table"
        aria-label="Voucher lines"
        className="overflow-hidden rounded-md border border-[var(--fd-border-subtle)]"
      >
        <div
          role="row"
          className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_8rem_8rem_2.5rem_2.5rem] gap-2 border-b border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-3 py-2 text-xs font-medium text-[var(--fd-text-secondary)] md:grid"
        >
          <span role="columnheader">Account</span>
          <span role="columnheader">Description</span>
          <span role="columnheader" className="text-right">
            Debit
          </span>
          <span role="columnheader" className="text-right">
            Credit
          </span>
          <span role="columnheader" aria-label="Tax" />
          <span role="columnheader" aria-label="Remove" />
        </div>

        {fields.map((field, index) => {
          const isOpen = expanded[field.id] === true;
          const lineErrors = errors.lines?.[index];
          const hasTax =
            (lines[index]?.gstRatePct ?? '').length > 0 ||
            (lines[index]?.tdsSection ?? '').length > 0;
          return (
            <div
              key={field.id}
              role="row"
              className={cn(
                'border-b border-[var(--fd-border-subtle)] px-3 py-2 last:border-b-0',
                lineErrors ? 'bg-[var(--fd-status-danger-bg,transparent)]' : '',
              )}
            >
              <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_8rem_8rem_2.5rem_2.5rem] md:items-start">
                <div role="cell">
                  <Controller
                    control={control}
                    name={`lines.${index}.accountId`}
                    render={({ field: accountField }) => (
                      <AccountPicker
                        clientId={clientId}
                        ariaLabel={`Line ${index + 1} account`}
                        value={accountField.value.length === 0 ? null : accountField.value}
                        onChange={(value) => {
                          accountField.onChange(value ?? '');
                        }}
                        invalid={fieldError(errors, index, 'accountId') !== undefined}
                        excludeSystem
                        disabled={disabled}
                        allowClear={false}
                      />
                    )}
                  />
                  {fieldError(errors, index, 'accountId') ? (
                    <p className="mt-1 text-xs text-[var(--fd-status-danger)]">
                      {fieldError(errors, index, 'accountId')}
                    </p>
                  ) : null}
                </div>
                <div role="cell">
                  <Input
                    aria-label={`Line ${index + 1} description`}
                    placeholder="Optional"
                    disabled={disabled}
                    {...register(`lines.${index}.description`)}
                  />
                </div>
                <div role="cell">
                  <Input
                    aria-label={`Line ${index + 1} debit`}
                    numeric
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={disabled}
                    invalid={fieldError(errors, index, 'debit') !== undefined}
                    {...register(`lines.${index}.debit`)}
                  />
                </div>
                <div role="cell">
                  <Input
                    aria-label={`Line ${index + 1} credit`}
                    numeric
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={disabled}
                    invalid={fieldError(errors, index, 'credit') !== undefined}
                    {...register(`lines.${index}.credit`)}
                  />
                </div>
                <div role="cell" className="flex justify-end">
                  <IconButton
                    label={isOpen ? `Hide tax for line ${index + 1}` : `Tax for line ${index + 1}`}
                    size="sm"
                    variant={hasTax ? 'secondary' : 'ghost'}
                    icon={
                      isOpen ? (
                        <ChevronUp size={14} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={14} aria-hidden="true" />
                      )
                    }
                    onClick={() => {
                      setExpanded((previous) => ({ ...previous, [field.id]: !isOpen }));
                    }}
                  />
                </div>
                <div role="cell" className="flex justify-end">
                  <IconButton
                    label={`Remove line ${index + 1}`}
                    size="sm"
                    variant="ghost"
                    disabled={disabled || fields.length <= 2}
                    icon={<Trash2 size={14} aria-hidden="true" />}
                    onClick={() => {
                      remove(index);
                    }}
                  />
                </div>
              </div>

              {fieldError(errors, index, 'debit') || fieldError(errors, index, 'credit') ? (
                <p className="mt-1 text-xs text-[var(--fd-status-danger)]">
                  {fieldError(errors, index, 'debit') ?? fieldError(errors, index, 'credit')}
                </p>
              ) : null}

              {isOpen ? (
                <div className="mt-2 grid gap-2 rounded-md bg-[var(--fd-surface-2)] p-2 sm:grid-cols-5">
                  <div className="text-xs">
                    <span className="mb-1 block text-[var(--fd-text-secondary)]">
                      Line {index + 1} GST %
                    </span>
                    <Input
                      numeric
                      inputMode="decimal"
                      placeholder="18"
                      disabled={disabled}
                      invalid={fieldError(errors, index, 'gstRatePct') !== undefined}
                      {...register(`lines.${index}.gstRatePct`)}
                    />
                  </div>
                  <div className="text-xs">
                    <span className="mb-1 block text-[var(--fd-text-secondary)]">
                      Line {index + 1} HSN / SAC
                    </span>
                    <Input
                      placeholder="9983"
                      disabled={disabled}
                      aria-label={`Line ${index + 1} HSN or SAC`}
                      {...register(`lines.${index}.hsnSac`)}
                    />
                  </div>
                  <div className="text-xs">
                    <span className="mb-1 block text-[var(--fd-text-secondary)]">
                      Line {index + 1} place of supply
                    </span>
                    <Input
                      placeholder="27"
                      maxLength={2}
                      disabled={disabled}
                      aria-label={`Line ${index + 1} place of supply`}
                      invalid={fieldError(errors, index, 'placeOfSupply') !== undefined}
                      {...register(`lines.${index}.placeOfSupply`)}
                    />
                  </div>
                  <div className="text-xs">
                    <span className="mb-1 block text-[var(--fd-text-secondary)]">
                      Line {index + 1} TDS section
                    </span>
                    <Input
                      placeholder="194J"
                      disabled={disabled}
                      aria-label={`Line ${index + 1} TDS section`}
                      invalid={fieldError(errors, index, 'tdsSection') !== undefined}
                      {...register(`lines.${index}.tdsSection`)}
                    />
                  </div>
                  <div className="text-xs">
                    <span className="mb-1 block text-[var(--fd-text-secondary)]">
                      Line {index + 1} TDS %
                    </span>
                    <Input
                      numeric
                      inputMode="decimal"
                      placeholder="10"
                      disabled={disabled}
                      invalid={fieldError(errors, index, 'tdsRatePct') !== undefined}
                      {...register(`lines.${index}.tdsRatePct`)}
                    />
                  </div>
                  {fieldError(errors, index, 'tdsSection') ||
                  fieldError(errors, index, 'gstRatePct') ||
                  fieldError(errors, index, 'placeOfSupply') ? (
                    <p className="text-xs text-[var(--fd-status-danger)] sm:col-span-5">
                      {fieldError(errors, index, 'tdsSection') ??
                        fieldError(errors, index, 'gstRatePct') ??
                        fieldError(errors, index, 'placeOfSupply')}
                    </p>
                  ) : null}
                  <p className="text-2xs text-[var(--fd-text-tertiary)] sm:col-span-5">
                    GST and TDS lines are added automatically when the voucher is saved. Enter the
                    base amount only.
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}

        <div
          role="row"
          className="grid gap-2 bg-[var(--fd-surface-2)] px-3 py-2 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_8rem_8rem_2.5rem_2.5rem]"
        >
          <span role="cell" className="font-medium md:col-span-2">
            Totals (before tax lines)
          </span>
          <span role="cell" className="text-right numeric font-medium">
            {formatPaise(totals.debit)}
          </span>
          <span role="cell" className="text-right numeric font-medium">
            {formatPaise(totals.credit)}
          </span>
          <span role="cell" className="md:col-span-2" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Plus size={14} aria-hidden="true" />}
          disabled={disabled}
          onClick={() => {
            append(emptyLine());
          }}
        >
          Add line
        </Button>
        <p
          className={cn(
            'numeric text-sm',
            projected.residual === 0 ? 'text-[var(--fd-text-secondary)]' : 'text-[var(--fd-status-danger)]',
          )}
          aria-live="polite"
        >
          {projected.residual === 0
            ? diff === 0
              ? 'Voucher balances.'
              : 'Voucher balances once GST/TDS lines are added on save.'
            : `${projected.residual > 0 ? 'Debits' : 'Credits'} exceed the other side by ${formatPaise(
                Math.abs(projected.residual),
              )} after tax lines — fix this before saving.`}
        </p>
      </div>
      {linesError ? <p className="text-xs text-[var(--fd-status-danger)]">{linesError}</p> : null}
    </div>
  );
}
