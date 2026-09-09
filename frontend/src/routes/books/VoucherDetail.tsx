import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { deleteVoucher, getVoucher, postVoucher, reverseVoucher } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, DefinitionList } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/hooks/useConfirm';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { VOUCHER_TYPE_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/date';
import { normaliseError } from '@/lib/errors';
import { VoucherStatusPill, useBooksClient } from '@/routes/books/components/BooksShell';
import type { VoucherLineView, VoucherView } from '@/types/models';

function LinesTable({ lines }: { lines: readonly VoucherLineView[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Voucher lines</caption>
        <thead>
          <tr className="border-b border-[var(--fd-border-subtle)] text-left text-xs text-[var(--fd-text-secondary)]">
            <th scope="col" className="py-2 pr-3 font-medium">
              Account
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Description
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Debit
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Credit
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr
              key={`${line.account?.id ?? 'x'}-${index}`}
              className={
                line.isDerived
                  ? 'border-b border-[var(--fd-border-subtle)] text-[var(--fd-text-secondary)]'
                  : 'border-b border-[var(--fd-border-subtle)]'
              }
            >
              <td className="py-2 pr-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="numeric text-xs text-[var(--fd-text-tertiary)]">
                    {line.account?.code}
                  </span>
                  <span className={line.credit.paise > 0 ? 'pl-4' : ''}>
                    {line.account?.name ?? '—'}
                  </span>
                  {line.isDerived ? <Badge tone="muted">engine</Badge> : null}
                  {line.tax?.gstRatePct ? (
                    <Badge tone="neutral">GST {line.tax.gstRatePct}%</Badge>
                  ) : null}
                  {line.tax?.tdsSection ? (
                    <Badge tone="neutral">
                      TDS {line.tax.tdsSection} @ {line.tax.tdsRatePct}%
                    </Badge>
                  ) : null}
                </span>
              </td>
              <td className="py-2 pr-3 text-[var(--fd-text-secondary)]">
                {line.description ?? ''}
              </td>
              <td className="py-2 pr-3 text-right numeric">
                {line.debit.paise > 0 ? line.debit.display : ''}
              </td>
              <td className="py-2 text-right numeric">
                {line.credit.paise > 0 ? line.credit.display : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VoucherDetail() {
  const { voucherId = '' } = useParams<{ voucherId: string }>();
  const [clientId] = useBooksClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { success, errorToast } = useToast();
  const confirm = useConfirm();

  const query = useQuery({
    queryKey: queryKeys.books.vouchers.detail(voucherId),
    queryFn: () => getVoucher(voucherId),
    enabled: voucherId.length > 0,
  });
  const voucher = query.data;
  usePageTitle(voucher?.voucherNo ?? 'Voucher');

  const suffix = `?client=${clientId ?? ''}`;
  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.books.all });
  };

  const post = useMutation({
    mutationFn: () => postVoucher(voucherId),
    onSuccess: (posted: VoucherView) => {
      invalidate();
      success('Voucher posted', `${posted.voucherNo ?? ''} · ${posted.total.display}`);
    },
    onError: (error: unknown) => {
      errorToast(error, 'That voucher was not posted');
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteVoucher(voucherId),
    onSuccess: () => {
      invalidate();
      success('Draft deleted');
      void navigate(`/books/vouchers${suffix}`, { replace: true });
    },
    onError: (error: unknown) => {
      errorToast(error, 'That draft was not deleted');
    },
  });

  const [reverseOpen, setReverseOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reverseDate, setReverseDate] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);

  const reverse = useMutation({
    mutationFn: () =>
      reverseVoucher(voucherId, {
        reason: reason.trim(),
        ...(reverseDate === null ? {} : { date: reverseDate }),
      }),
    onSuccess: (draft: VoucherView) => {
      invalidate();
      setReverseOpen(false);
      success(
        'Reversal drafted',
        `Dated ${formatDate(draft.date)}. Post it to complete the correction.`,
      );
      void navigate(`/books/vouchers/${draft.id}${suffix}`);
    },
    onError: (error: unknown) => {
      setReverseError(normaliseError(error).message);
    },
  });

  if (query.isPending) {
    return (
      <>
        <PageHeader title="Voucher" />
        <Card>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-3 h-40" />
        </Card>
      </>
    );
  }
  if (query.isError || !voucher) {
    return (
      <>
        <PageHeader title="Voucher" />
        <ErrorState
          error={query.error}
          title="This voucher did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      </>
    );
  }

  const isDraft = voucher.status === 'draft';
  const canReverse = voucher.status === 'posted' || voucher.status === 'locked';
  const title = voucher.voucherNo ?? `Draft ${VOUCHER_TYPE_LABELS[voucher.type].toLowerCase()}`;

  return (
    <>
      <PageHeader
        title={title}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Books', to: `/books${suffix}` },
              { label: 'Vouchers', to: `/books/vouchers${suffix}` },
              { label: title },
            ]}
          />
        }
        meta={<VoucherStatusPill status={voucher.status} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {isDraft && allows('books:write') ? (
              <Button
                asChild
                variant="secondary"
                iconLeft={<Pencil size={14} aria-hidden="true" />}
              >
                <Link to={`/books/vouchers/${voucher.id}/edit${suffix}`}>Edit</Link>
              </Button>
            ) : null}
            {isDraft && allows('books:delete_draft') ? (
              <Button
                variant="danger"
                iconLeft={<Trash2 size={14} aria-hidden="true" />}
                loading={remove.isPending}
                onClick={() => {
                  confirm.ask({
                    title: 'Delete this draft?',
                    body: 'Drafts are removed permanently. No voucher number is consumed.',
                    confirmLabel: 'Delete draft',
                    destructive: true,
                    onConfirm: () => remove.mutateAsync().then(() => undefined),
                  });
                }}
              >
                Delete
              </Button>
            ) : null}
            {isDraft && allows('books:post') ? (
              <Button
                variant="primary"
                iconLeft={<CheckCircle2 size={14} aria-hidden="true" />}
                loading={post.isPending}
                loadingLabel="Posting"
                onClick={() => {
                  confirm.ask({
                    title: 'Post this voucher?',
                    body: `${VOUCHER_TYPE_LABELS[voucher.type]} dated ${formatDate(voucher.date)} for ${voucher.total.display}. Once posted it takes the next voucher number and can only be corrected by a reversal.`,
                    confirmLabel: 'Post voucher',
                    onConfirm: () => post.mutateAsync().then(() => undefined),
                  });
                }}
              >
                Post
              </Button>
            ) : null}
            {canReverse && allows('books:post') ? (
              <Button
                variant="secondary"
                iconLeft={<RotateCcw size={14} aria-hidden="true" />}
                onClick={() => {
                  setReason('');
                  setReverseDate(null);
                  setReverseError(null);
                  setReverseOpen(true);
                }}
              >
                Reverse
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader
            title="Lines"
            description="Engine lines carry the GST and TDS derived from the base lines."
          />
          <div className="mt-3">
            <LinesTable lines={voucher.lines} />
            <div className="mt-2 flex justify-end gap-8 border-t border-[var(--fd-border-subtle)] pt-2 text-sm font-medium">
              <span>Total</span>
              <span className="numeric">{voucher.total.display}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Details" />
            <div className="mt-3">
              <DefinitionList
                items={[
                  { label: 'Date', value: formatDate(voucher.date) },
                  { label: 'Type', value: VOUCHER_TYPE_LABELS[voucher.type] },
                  { label: 'Financial year', value: voucher.fyLabel },
                  { label: 'Reference', value: voucher.reference ?? '—' },
                  { label: 'Source', value: voucher.source },
                  { label: 'Posted', value: formatDateTime(voucher.postedAt, 'Not yet') },
                  ...(voucher.lockedAt
                    ? [{ label: 'Locked', value: formatDateTime(voucher.lockedAt) }]
                    : []),
                ]}
              />
            </div>
            {voucher.narration ? (
              <p className="mt-3 text-sm text-[var(--fd-text-secondary)]">{voucher.narration}</p>
            ) : null}
          </Card>

          {voucher.reversalOf || voucher.reversedBy ? (
            <Card>
              <CardHeader title="Linked" />
              <ul className="mt-3 space-y-1 text-sm">
                {voucher.reversalOf ? (
                  <li>
                    Reverses{' '}
                    <Link
                      to={`/books/vouchers/${voucher.reversalOf}${suffix}`}
                      className="text-[var(--fd-accent)] hover:underline"
                    >
                      the original voucher
                    </Link>
                  </li>
                ) : null}
                {voucher.reversedBy ? (
                  <li>
                    Reversed by{' '}
                    <Link
                      to={`/books/vouchers/${voucher.reversedBy}${suffix}`}
                      className="text-[var(--fd-accent)] hover:underline"
                    >
                      a later voucher
                    </Link>
                  </li>
                ) : null}
              </ul>
            </Card>
          ) : null}

          {voucher.derived.outputTax.paise +
            voucher.derived.inputTax.paise +
            voucher.derived.tdsPayable.paise +
            voucher.derived.tdsReceivable.paise +
            voucher.derived.rounding.paise >
          0 ? (
            <Card>
              <CardHeader title="Derived tax" />
              <div className="mt-3">
                <DefinitionList
                  items={[
                    ...(voucher.derived.outputTax.paise > 0
                      ? [{ label: 'Output GST', value: voucher.derived.outputTax.display }]
                      : []),
                    ...(voucher.derived.inputTax.paise > 0
                      ? [{ label: 'Input GST', value: voucher.derived.inputTax.display }]
                      : []),
                    ...(voucher.derived.tdsPayable.paise > 0
                      ? [{ label: 'TDS payable', value: voucher.derived.tdsPayable.display }]
                      : []),
                    ...(voucher.derived.tdsReceivable.paise > 0
                      ? [{ label: 'TDS receivable', value: voucher.derived.tdsReceivable.display }]
                      : []),
                    ...(voucher.derived.rounding.paise > 0
                      ? [{ label: 'Rounding', value: voucher.derived.rounding.display }]
                      : []),
                  ]}
                />
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {confirm.request ? (
        <ConfirmDialog
          open={confirm.open}
          onOpenChange={confirm.setOpen}
          title={confirm.request.title}
          body={confirm.request.body}
          confirmLabel={confirm.request.confirmLabel}
          destructive={confirm.request.destructive ?? false}
          pending={confirm.pending}
          onConfirm={confirm.confirm}
        />
      ) : null}

      <Dialog
        open={reverseOpen}
        onOpenChange={setReverseOpen}
        title={`Reverse ${voucher.voucherNo ?? 'this voucher'}`}
        description="A mirrored draft is created. Post it to cancel the original's effect. If the requested date falls in a locked period the reversal moves to the first open date."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setReverseOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={reason.trim().length < 3}
              loading={reverse.isPending}
              onClick={() => {
                setReverseError(null);
                reverse.mutate();
              }}
            >
              Create reversal draft
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {reverseError === null ? null : <InlineError message={reverseError} />}
          <FormField label="Reason" required helper="Goes into the reversal narration.">
            {({ inputId, describedBy }) => (
              <Textarea
                id={inputId}
                aria-describedby={describedBy}
                rows={2}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
            )}
          </FormField>
          <FormField label="Reversal date" helper="Defaults to today.">
            {({ inputId, describedBy }) => (
              <DatePicker
                id={inputId}
                ariaDescribedBy={describedBy}
                value={reverseDate}
                onChange={setReverseDate}
              />
            )}
          </FormField>
        </div>
      </Dialog>
    </>
  );
}
