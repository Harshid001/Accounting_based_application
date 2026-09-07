import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, Lock, Wand2 } from 'lucide-react';
import { useState } from 'react';

import { updateComplianceItem } from '@/api/compliance.api';
import {
  downloadPreparationPayload,
  getFilingPreparation,
  lockFilingPreparation,
  prepareFilingReturn,
  updateGuideStep,
} from '@/api/filingPreparation.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/context/ToastContext';
import type { FilingPreparationView } from '@/types/models';

export interface GuidedFilingProps {
  filingId: string;
  canEdit: boolean;
  acknowledgementRef?: string | null;
}

const labelFor = (key: string): string =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()).toLowerCase();

const valueOf = (value: unknown): string => {
  if (typeof value === 'number') {
    return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  if (typeof value === 'string') return value;
  return '—';
};

const statusTone = (status: FilingPreparationView['status']): 'done' | 'neutral' =>
  status === 'ready' || status === 'locked' ? 'done' : 'neutral';

const statusLabel = (status: FilingPreparationView['status']): string => {
  switch (status) {
    case 'draft':
      return 'Draft — inputs missing';
    case 'locked':
      return 'Locked';
    default:
      return 'Ready to file';
  }
};

const summaryEntries = (summary: Record<string, unknown>): Array<[string, unknown]> =>
  Object.entries(summary).filter(([, value]) => typeof value === 'number' || typeof value === 'string');

export function GuidedFiling({ filingId, canEdit, acknowledgementRef }: GuidedFilingProps) {
  const queryClient = useQueryClient();
  const { success, errorToast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [customArn, setCustomArn] = useState<string | null>(null);
  const arn = customArn ?? acknowledgementRef ?? '';

  const preparation = useQuery({
    queryKey: queryKeys.filingPreparations.detail(filingId),
    queryFn: () => getFilingPreparation(filingId),
    retry: false,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.filingPreparations.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.compliance.all });
  };

  const prepare = useMutation({
    mutationFn: () => prepareFilingReturn(filingId),
    onSuccess: (data) => {
      invalidate();
      success(
        'Return prepared',
        data.missingInputs.length === 0
          ? 'Everything needed is on file. Follow the portal steps below to file it.'
          : `${data.missingInputs.length} input${data.missingInputs.length === 1 ? '' : 's'} still missing — see the list below.`,
      );
    },
    onError: (error: unknown) => {
      errorToast(error, 'The return could not be prepared');
    },
  });

  const toggleStep = useMutation({
    mutationFn: ({ stepIndex, done }: { stepIndex: number; done: boolean }) =>
      updateGuideStep(filingId, stepIndex, done),
    onSuccess: () => {
      invalidate();
    },
    onError: (error: unknown) => {
      errorToast(error, 'That step did not update');
    },
  });

  const lock = useMutation({
    mutationFn: () => lockFilingPreparation(filingId),
    onSuccess: () => {
      invalidate();
      success('Preparation locked', 'The figures are frozen for the record.');
    },
    onError: (error: unknown) => {
      errorToast(error, 'The preparation could not be locked');
    },
  });

  const saveArn = useMutation({
    mutationFn: (newRef: string) =>
      updateComplianceItem(filingId, {
        acknowledgementRef: newRef.trim().length === 0 ? null : newRef.trim(),
      }),
    onSuccess: () => {
      setCustomArn(null);
      invalidate();
      success('Acknowledgement saved', 'The ARN has been recorded on this filing.');
    },
    onError: (error: unknown) => {
      errorToast(error, 'Could not save the acknowledgement reference');
    },
  });

  const data = preparation.data;
  const stepsDone = data?.guideSteps.filter((step) => step.done).length ?? 0;
  const stepsTotal = data?.guideSteps.length ?? 0;
  const locked = data?.status === 'locked';

  const handleDownload = async (): Promise<void> => {
    if (!data) return;
    setDownloading(true);
    try {
      const sanitizedPeriod = data.periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${data.formCode}_${sanitizedPeriod}.json`;
      await downloadPreparationPayload(filingId, filename);
      success('Return payload downloaded', filename);
    } catch (err: unknown) {
      errorToast(err, 'Could not download return file');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Autonomous filing"
        description="The copilot prepares the return from the documents on file, then walks you through the government portal."
        actions={
          <div className="flex items-center gap-2">
            {data !== undefined ? (
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Download size={14} aria-hidden="true" />}
                loading={downloading}
                loadingLabel="Downloading"
                onClick={() => {
                  void handleDownload();
                }}
              >
                Download file
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Wand2 size={14} aria-hidden="true" />}
              loading={prepare.isPending}
              loadingLabel="Preparing"
              disabled={!canEdit}
              onClick={() => {
                prepare.mutate();
              }}
            >
              {data === undefined ? 'Prepare return' : 'Recompute'}
            </Button>
          </div>
        }
      />

      {preparation.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-20 w-full" rounded="lg" />
          <Skeleton className="h-20 w-full" rounded="lg" />
        </div>
      ) : null}

      {preparation.isError && !prepare.isPending ? (
        <ErrorState
          error={preparation.error}
          title="Not prepared yet"
          onRetry={() => {
            prepare.mutate();
          }}
        />
      ) : null}

      {data === undefined ? null : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(data.status)}>{statusLabel(data.status)}</Badge>
            {data.portalName === null ? null : <Badge tone="neutral">{data.portalName}</Badge>}
          </div>

          {data.missingInputs.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">Still needed before filing:</p>
              <ul className="mt-1 list-disc pl-5">
                {data.missingInputs.map((input) => (
                  <li key={input}>{input}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-1 text-xs font-medium text-[var(--fd-text-secondary)]">
              Computed figures
            </p>
            <dl className="space-y-1 text-sm">
              {summaryEntries(data.summary).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <dt className="text-[var(--fd-text-secondary)]">{labelFor(key)}</dt>
                  <dd className="font-medium">{valueOf(value)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-[var(--fd-text-secondary)]">
              Documents used
            </p>
            <p className="text-sm text-[var(--fd-text-primary)]">
              {data.inputCounts.salesInvoiceCount} sales invoices ·{' '}
              {data.inputCounts.purchaseInvoiceCount} purchase invoices ·{' '}
              {data.inputCounts.bankStatementCount} bank statements ·{' '}
              {data.inputCounts.taxDocumentCount} tax documents
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--fd-text-secondary)]">
                Portal filing steps
              </p>
              {data.portalUrl === null ? null : (
                <a
                  href={data.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-[var(--fd-accent)] hover:underline"
                >
                  Open portal
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>

            {stepsTotal === 0 ? null : (
              <ProgressBar
                value={stepsDone}
                max={stepsTotal}
                showValue
                tone={stepsDone === stepsTotal ? 'done' : 'accent'}
                label="Portal steps completed"
                className="mb-2"
              />
            )}

            <ol className="space-y-3">
              {data.guideSteps.map((step, index) => (
                <li key={step.title} className="flex items-start gap-2">
                  <Checkbox
                    checked={step.done}
                    disabled={!canEdit || locked || toggleStep.isPending}
                    label={step.title}
                    onCheckedChange={(checked) => {
                      toggleStep.mutate({ stepIndex: index, done: checked });
                    }}
                    className={step.done ? 'opacity-70' : ''}
                  />
                  <div className="min-w-0">
                    {step.detail === null ? null : (
                      <p className="text-xs text-[var(--fd-text-tertiary)]">{step.detail}</p>
                    )}
                    {step.portalUrl === null ? null : (
                      <a
                        href={step.portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-[var(--fd-accent)] hover:underline"
                      >
                        {step.portalUrl}
                        <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--fd-text-secondary)]">
                Filing Acknowledgement (ARN)
              </span>
              {acknowledgementRef ? (
                <Badge tone="done">Recorded: {acknowledgementRef}</Badge>
              ) : (
                <Badge tone="neutral">Not recorded</Badge>
              )}
            </div>
            <p className="text-xs text-[var(--fd-text-tertiary)]">
              Paste the Application Reference Number (ARN), token, or challan number from the portal receipt to record it on this filing.
            </p>
            <div className="flex gap-2">
              <Input
                id="filing-arn-input"
                aria-label="Acknowledgement reference (ARN)"
                value={arn}
                disabled={!canEdit || saveArn.isPending}
                placeholder="e.g. AA2707240123456 or 20262712345678"
                onChange={(e) => {
                  setCustomArn(e.target.value);
                }}
                className="h-8 text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!canEdit || saveArn.isPending || arn.trim() === (acknowledgementRef ?? '').trim()}
                loading={saveArn.isPending}
                loadingLabel="Saving"
                onClick={() => {
                  saveArn.mutate(arn);
                }}
              >
                Save ARN
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {data.status === 'ready' && canEdit ? (
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Lock size={14} aria-hidden="true" />}
                loading={lock.isPending}
                loadingLabel="Locking"
                onClick={() => {
                  lock.mutate();
                }}
              >
                Lock figures
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Download size={14} aria-hidden="true" />}
              loading={downloading}
              loadingLabel="Downloading"
              onClick={() => {
                void handleDownload();
              }}
            >
              Download portal JSON
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
