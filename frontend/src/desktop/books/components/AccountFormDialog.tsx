import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { createAccount, updateAccount } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog } from '@/components/ui/dialog';
import { InlineError } from '@/components/ui/error-state';
import { FieldRow, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/context/ToastContext';
import { ACCOUNT_SUB_TYPE_LABELS, ACCOUNT_TYPE_LABELS } from '@/lib/constants';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import {
  accountSchema,
  accountToForm,
  emptyAccount,
  toAccountPayload,
} from '@/schemas/books.schema';
import type { AccountFormValues } from '@/schemas/books.schema';
import { ACCOUNT_SUB_TYPES, ACCOUNT_TYPES, SYSTEM_ACCOUNT_SUB_TYPES } from '@/types/enums';
import type { AccountView } from '@/types/models';

export interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  /** When present the dialog edits; otherwise it creates. */
  account?: AccountView | null;
}

const currentFyStart = (): string => {
  const now = new Date();
  const year = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
};

const selectableSubTypes = ACCOUNT_SUB_TYPES.filter(
  (subType) => !SYSTEM_ACCOUNT_SUB_TYPES.includes(subType),
);

export function AccountFormDialog({
  open,
  onOpenChange,
  clientId,
  account,
}: AccountFormDialogProps) {
  const queryClient = useQueryClient();
  const { success } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = account !== null && account !== undefined;

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: isEdit ? accountToForm(account) : emptyAccount(currentFyStart()),
  });

  useEffect(() => {
    if (open) {
      form.reset(isEdit ? accountToForm(account) : emptyAccount(currentFyStart()));
    }
  }, [open, account, isEdit, form]);

  const mutation = useMutation({
    mutationFn: (values: AccountFormValues) =>
      isEdit
        ? updateAccount(account.id, toAccountPayload(values, { isEdit: true }))
        : createAccount(toAccountPayload(values, { clientId })),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.books.all });
      success(isEdit ? 'Account updated' : 'Account added', `${saved.code} · ${saved.name}`);
      setFormError(null);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const normalised = normaliseError(error);
      setFormError(normalised.message);
      for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
        const key = field.startsWith('openingBalance') ? 'openingAmount' : field;
        form.setError(key as keyof AccountFormValues, { type: 'server', message });
      }
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    await mutation.mutateAsync(values).catch(() => undefined);
  });

  const errors = form.formState.errors;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setFormError(null);
        onOpenChange(next);
      }}
      title={isEdit ? `Edit ${account.code}` : 'Add an account'}
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            loadingLabel="Saving"
            onClick={() => {
              void submit();
            }}
          >
            {isEdit ? 'Save changes' : 'Add account'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError === null ? null : <InlineError message={formError} />}

        <FieldRow>
          <FormField
            label="Code"
            required
            helper={isEdit ? 'Codes are permanent.' : 'Short and unique, like 1001.'}
            error={errors.code?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                invalid={invalid}
                aria-describedby={describedBy}
                disabled={isEdit}
                placeholder="1001"
                {...form.register('code')}
              />
            )}
          </FormField>
          <FormField label="Name" required error={errors.name?.message}>
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="Cash in Hand"
                {...form.register('name')}
              />
            )}
          </FormField>
        </FieldRow>

        <FieldRow>
          <FormField
            label="Type"
            required
            helper={isEdit ? 'The type cannot change once entries exist.' : undefined}
            error={errors.type?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    id={inputId}
                    ariaDescribedBy={describedBy}
                    invalid={invalid}
                    disabled={isEdit}
                    value={field.value}
                    onValueChange={field.onChange}
                    options={ACCOUNT_TYPES.map((type) => ({
                      value: type,
                      label: ACCOUNT_TYPE_LABELS[type],
                    }))}
                  />
                )}
              />
            )}
          </FormField>
          <FormField label="Sub-type" helper="Optional. Helps group debtors, creditors and banks.">
            {({ inputId, describedBy }) => (
              <Controller
                control={form.control}
                name="subType"
                render={({ field }) => (
                  <Select
                    id={inputId}
                    ariaDescribedBy={describedBy}
                    value={field.value === '' ? '__none__' : field.value}
                    onValueChange={(value) => {
                      field.onChange(value === '__none__' ? '' : value);
                    }}
                    options={[
                      { value: '__none__', label: 'None' },
                      ...selectableSubTypes.map((subType) => ({
                        value: subType,
                        label: ACCOUNT_SUB_TYPE_LABELS[subType],
                      })),
                    ]}
                  />
                )}
              />
            )}
          </FormField>
        </FieldRow>

        <FieldRow>
          <FormField
            label="Party GSTIN"
            helper="For debtors and creditors."
            error={errors.gstin?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="27ABCDE1234F1Z5"
                className="uppercase"
                {...form.register('gstin')}
              />
            )}
          </FormField>
          <FormField label="Party PAN" error={errors.pan?.message}>
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="ABCDE1234F"
                className="uppercase"
                {...form.register('pan')}
              />
            )}
          </FormField>
        </FieldRow>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label="Opening balance"
            helper="In rupees."
            error={errors.openingAmount?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                invalid={invalid}
                numeric
                inputMode="decimal"
                aria-describedby={describedBy}
                placeholder="0.00"
                {...form.register('openingAmount')}
              />
            )}
          </FormField>
          <FormField label="Side">
            {({ inputId, describedBy }) => (
              <Controller
                control={form.control}
                name="openingSide"
                render={({ field }) => (
                  <Select
                    id={inputId}
                    ariaDescribedBy={describedBy}
                    value={field.value}
                    onValueChange={field.onChange}
                    options={[
                      { value: 'Dr', label: 'Debit (Dr)' },
                      { value: 'Cr', label: 'Credit (Cr)' },
                    ]}
                  />
                )}
              />
            )}
          </FormField>
          <FormField label="As of" required error={errors.openingAsOf?.message}>
            {({ inputId, describedBy, invalid }) => (
              <Controller
                control={form.control}
                name="openingAsOf"
                render={({ field }) => (
                  <DatePicker
                    id={inputId}
                    ariaDescribedBy={describedBy}
                    invalid={invalid}
                    value={field.value.length === 0 ? null : field.value}
                    onChange={(value) => {
                      field.onChange(value ?? '');
                    }}
                  />
                )}
              />
            )}
          </FormField>
        </div>
      </div>
    </Dialog>
  );
}
