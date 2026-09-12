import { useMutation, useQuery } from '@tanstack/react-query';
import { RefreshCw, Upload } from 'lucide-react';
import { useState } from 'react';

import { checkTallyConnection, fetchTallyBridgeStatus, importTallyLedgers } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/context/ToastContext';
import { formatDateTime } from '@/lib/date';

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 rounded-full ${
        ok ? 'bg-[var(--fd-status-done)]' : 'bg-[var(--fd-status-danger)]'
      }`}
    />
  );
}

interface TallyBridgeCardProps {
  clientId: string;
}

export function TallyBridgeCard({ clientId }: TallyBridgeCardProps) {
  const { success, errorToast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.books.tally(clientId),
    queryFn: () => fetchTallyBridgeStatus(clientId),
    enabled: clientId.length > 0,
  });
  const status = query.data;

  const check = useMutation({
    mutationFn: () => checkTallyConnection(clientId),
    onSuccess: (result) => {
      success('Tally probe queued', `Command ${result.commandId.slice(0, 8)}… will run on the desktop app.`);
      void query.refetch();
    },
    onError: (error: unknown) => {
      errorToast(error, 'The Tally probe was not queued');
    },
  });

  const doImport = useMutation({
    mutationFn: () => importTallyLedgers(clientId),
    onSuccess: (result) => {
      setImportOpen(false);
      success('Ledger import queued', `${result.companyName} ledgers will arrive via ${result.workstation}.`);
      void query.refetch();
    },
    onError: (error: unknown) => {
      errorToast(error, 'The ledger import was not queued');
    },
  });

  const showFullCheck = status !== undefined && status.workstation.online && !status.tally.reachable;
  const canImport = status !== undefined && status.workstation.online && status.booksMode !== 'native';

  return (
    <Card>
      <CardHeader
        title="Tally bridge"
        description="Live connection between this client's books and the real Tally company via the desktop app."
        actions={
          status !== undefined ? (
            <Badge tone={status.workstation.online ? 'done' : 'muted'}>
              {status.workstation.online ? 'Desktop online' : 'Desktop offline'}
            </Badge>
          ) : null
        }
      />
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--fd-text-secondary)]">Tally company</dt>
          <dd className="text-right">{status?.companyName ? `${status.companyName} (${status.booksMode})` : '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-2 text-[var(--fd-text-secondary)]">
            <StatusDot ok={status?.tally.reachable ?? false} />
            Tally reachable
          </dt>
          <dd className="text-right">
            {status?.tally.reachable ? 'Connected' : 'Not reachable'}
            {status?.tally.educationMode ? (
              <Badge tone="waiting" className="ml-2">
                Education mode
              </Badge>
            ) : null}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--fd-text-secondary)]">Probed</dt>
          <dd className="numeric">{formatDateTime(status?.tally.checkedAt ?? null, 'Never')}</dd>
        </div>
        {status && status.pendingPosts > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--fd-text-secondary)]">Posts pending Tally</dt>
            <dd className="numeric">{status.pendingPosts}</dd>
          </div>
        ) : null}
      </div>

      {showFullCheck ? (
        <p className="mt-3 rounded-md border border-[var(--fd-status-waiting)] bg-[var(--fd-status-waiting-bg)] px-3 py-2 text-xs text-[var(--fd-text-primary)]">
          The desktop app is online but Tally did not report the{' '}
          {status?.companyName ?? 'expected'} company. You may need to open the company in Tally, or
          run a fresh probe.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<RefreshCw size={14} aria-hidden="true" />}
          loading={check.isPending}
          disabled={!status?.workstation.online}
          onClick={() => {
            setCheckOpen(true);
          }}
        >
          Probe now
        </Button>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Upload size={14} aria-hidden="true" />}
          loading={doImport.isPending}
          disabled={!canImport}
          onClick={() => {
            setImportOpen(true);
          }}
        >
          Import ledgers
        </Button>
      </div>

      <Dialog
        open={checkOpen}
        onOpenChange={setCheckOpen}
        title="Probe Tally now?"
        description="Queues a live health check to the desktop app. The next poll will report whether the Tally company is open and reachable."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCheckOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={check.isPending}
              onClick={() => {
                setCheckOpen(false);
                check.mutate();
              }}
            >
              Queue probe
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--fd-text-secondary)]">
          You can also verify the outcome from the status above after the desktop app picks this up.
        </p>
      </Dialog>

      <ConfirmDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Tally ledgers?"
        body="Reads the ledger masters from the client's Tally company and creates matching accounts here. Existing accounts are never overwritten or changed — this is a one-way, read-only import."
        confirmLabel="Import ledgers"
        pending={doImport.isPending}
        onConfirm={() => {
          doImport.mutate();
        }}
      />
    </Card>
  );
}