import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { createVoucher, getVoucher, postVoucher, updateVoucher } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { FieldRow, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { VOUCHER_TYPE_LABELS } from '@/lib/constants';
import { todayDateOnly } from '@/lib/date';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { ChooseClientState, useBooksClient } from '@/desktop/books/components/BooksShell';
import { VoucherLinesEditor } from '@/desktop/books/components/VoucherLinesEditor';
import {
  emptyVoucher,
  toVoucherPayload,
  voucherSchema,
  voucherToForm,
} from '@/schemas/books.schema';
import type { VoucherFormValues } from '@/schemas/books.schema';
import { VOUCHER_TYPES } from '@/types/enums';
import type { VoucherView } from '@/types/models';

const TYPE_HINTS: Record<string, string> = {
  sales:
    'Debit the customer, credit Sales with the GST rate on the Sales line. Output GST is added for you.',
  purchase:
    'Debit the expense/purchase account with the GST rate, credit the supplier. Input GST is added for you.',
  payment:
    'Debit the expense or creditor, credit bank or cash. Add a TDS section to book TDS payable.',
  receipt: 'Debit bank or cash, credit the customer.',
  contra: 'Move money between cash and bank.',
  journal: 'Any adjustment. Debits must equal credits after tax lines.',
  debit_note: 'Return to a supplier: debit the supplier, credit purchases with the GST rate.',
  credit_note: 'Return from a customer: debit Sales with the GST rate, credit the customer.',
};

export function VoucherEntry() {
  const { voucherId } = useParams<{ voucherId: string }>();
  const isEdit = voucherId !== undefined;
  usePageTitle(isEdit ? 'Edit voucher' : 'New voucher');

  const [clientId] = useBooksClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { success, errorToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: queryKeys.books.vouchers.detail(voucherId ?? ''),
    queryFn: () => getVoucher(voucherId ?? ''),
    enabled: isEdit,
  });

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherSchema),
    defaultValues: emptyVoucher(todayDateOnly()),
  });

  useEffect(() => {
    if (existing.data) {
      form.reset(voucherToForm(existing.data));
    }
  }, [existing.data, form]);

  const applyServerErrors = (error: unknown): void => {
    const normalised = normaliseError(error);
    setFormError(normalised.message);
    for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
      // Server paths look like lines.2.accountId or lines.2.tax.gstRatePct.
      const key = field.replace(/\.tax\./, '.').replace(/Paise$/, '');
      form.setError(key as never, { type: 'server', message });
    }
  };

  const save = useMutation({
    mutationFn: (input: { values: VoucherFormValues; thenPost: boolean }) =>
      isEdit
        ? updateVoucher(voucherId, toVoucherPayload(input.values))
        : createVoucher(toVoucherPayload(input.values, { clientId: clientId ?? '' })),
    onSuccess: async (saved: VoucherView, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.books.all });
      if (input.thenPost) {
        try {
          const posted = await postVoucher(saved.id);
          void queryClient.invalidateQueries({ queryKey: queryKeys.books.all });
          success('Voucher posted', `${posted.voucherNo ?? ''} · ${posted.total.display}`);
          void navigate(`/books/vouchers/${posted.id}?client=${clientId ?? ''}`);
          return;
        } catch (error) {
          errorToast(error, 'Saved as a draft, but it could not be posted');
          void navigate(`/books/vouchers/${saved.id}?client=${clientId ?? ''}`);
          return;
        }
      }
      success(isEdit ? 'Draft updated' : 'Draft saved', saved.total.display);
      void navigate(`/books/vouchers/${saved.id}?client=${clientId ?? ''}`);
    },
    onError: applyServerErrors,
  });

  const submit = (thenPost: boolean) =>
    form.handleSubmit(async (values) => {
      setFormError(null);
      await save.mutateAsync({ values, thenPost }).catch(() => undefined);
    });

  const type = form.watch('type');
  const listHref = `/books/vouchers?client=${clientId ?? ''}`;

  if (isEdit && existing.data && existing.data.status !== 'draft') {
    return (
      <>
        <PageHeader title="This voucher is posted" />
        <ErrorState
          error={new Error('Posted vouchers are immutable. Create a reversal to correct one.')}
          title="Posted vouchers cannot be edited"
        />
        <Button asChild variant="secondary" className="mt-4">
          <Link to={`/books/vouchers/${existing.data.id}?client=${clientId ?? ''}`}>
            Back to voucher
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit draft` : 'New voucher'}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Books', to: `/books?client=${clientId ?? ''}` },
              { label: 'Vouchers', to: listHref },
              { label: isEdit ? 'Edit draft' : 'New' },
            ]}
          />
        }
        description="Enter the base lines only. GST and TDS duty lines are materialised by the engine when you save."
      />

      {clientId === null ? (
        <>
          <ChooseClientState />
          <div className="mt-4 max-w-sm">
            <FormField label="Client" required>
              {() => (
                <Button asChild variant="secondary">
                  <Link to="/books">Choose a client on the Books overview</Link>
                </Button>
              )}
            </FormField>
          </div>
        </>
      ) : isEdit && existing.isPending ? (
        <Card>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-3 h-40" />
        </Card>
      ) : isEdit && existing.isError ? (
        <ErrorState
          error={existing.error}
          title="This draft did not load"
          onRetry={() => {
            void existing.refetch();
          }}
        />
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(false)();
          }}
        >
          {formError === null ? null : <InlineError message={formError} />}

          <Card>
            <CardHeader title="Voucher" />
            <div className="mt-3 space-y-4">
              <FieldRow>
                <FormField label="Date" required error={form.formState.errors.date?.message}>
                  {({ inputId, describedBy, invalid }) => (
                    <Controller
                      control={form.control}
                      name="date"
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
                <FormField label="Type" required helper={TYPE_HINTS[type]}>
                  {({ inputId, describedBy }) => (
                    <Controller
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <Select
                          id={inputId}
                          ariaDescribedBy={describedBy}
                          value={field.value}
                          onValueChange={field.onChange}
                          options={VOUCHER_TYPES.map((value) => ({
                            value,
                            label: VOUCHER_TYPE_LABELS[value],
                          }))}
                        />
                      )}
                    />
                  )}
                </FormField>
              </FieldRow>
              <FieldRow>
                <FormField
                  label="Reference"
                  helper="Invoice or bill number."
                  error={form.formState.errors.reference?.message}
                >
                  {({ inputId, describedBy, invalid }) => (
                    <Input
                      id={inputId}
                      invalid={invalid}
                      aria-describedby={describedBy}
                      placeholder="INV-0042"
                      {...form.register('reference')}
                    />
                  )}
                </FormField>
                <FormField label="Narration" error={form.formState.errors.narration?.message}>
                  {({ inputId, describedBy, invalid }) => (
                    <Textarea
                      id={inputId}
                      invalid={invalid}
                      aria-describedby={describedBy}
                      rows={2}
                      placeholder="Being goods sold to Sharma Traders vide INV-0042"
                      {...form.register('narration')}
                    />
                  )}
                </FormField>
              </FieldRow>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Lines"
              description="Amounts in rupees. Open the tax panel on a line to add GST or TDS."
            />
            <div className="mt-3">
              <VoucherLinesEditor
                clientId={clientId}
                control={form.control}
                register={form.register}
                errors={form.formState.errors}
                disabled={save.isPending}
              />
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="ghost">
              <Link to={listHref}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              variant="secondary"
              loading={save.isPending && !save.variables?.thenPost}
            >
              {isEdit ? 'Save draft' : 'Save as draft'}
            </Button>
            {allows('books:post') ? (
              <Button
                type="button"
                variant="primary"
                loading={save.isPending && save.variables?.thenPost === true}
                loadingLabel="Posting"
                onClick={() => {
                  void submit(true)();
                }}
              >
                Save and post
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </>
  );
}
