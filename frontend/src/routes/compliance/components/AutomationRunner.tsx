import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, Circle, RefreshCw, XCircle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useEffect, useState } from 'react';

import { abortAutomationRun, downloadEvidencePack, getAutomationRun, submitHandoff } from '@/api/automation.api';
import { subscribeSse } from '@/api/sse';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useToast } from '@/context/ToastContext';

export interface AutomationRunnerProps {
  runId: string;
  onDone?: () => void;
}

interface SseEvent {
  kind: string;
  frameData?: string;
  handoffId?: string;
  handoffType?: string;
  handoffPrompt?: string;
  error?: string;
}

export function AutomationRunner({ runId, onDone }: AutomationRunnerProps) {
  const queryClient = useQueryClient();
  const { success, errorToast } = useToast();
  
  const [frame, setFrame] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<{ id: string, type: string, prompt: string } | null>(null);
  const [handoffValue, setHandoffValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Initial fetch
  const { data: run, refetch } = useQuery({
    queryKey: queryKeys.automation.detail(runId),
    queryFn: () => getAutomationRun(runId),
  });

  const runStatus = run?.status;

  // SSE stream
  useEffect(() => {
    if (!runStatus) return;
    if (runStatus === 'succeeded' || runStatus === 'failed' || runStatus === 'aborted') return;

    const subscription = subscribeSse(`/automation/runs/${runId}/events`, {
      onMessage: (raw) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const event: SseEvent = JSON.parse(raw);

        switch (event.kind) {
          case 'frame':
            setFrame(event.frameData ?? null);
            break;
          case 'step_start':
          case 'step_done':
          case 'step_failed':
            void refetch();
            break;
          case 'handoff_required':
            setHandoff({
              id: event.handoffId ?? '',
              type: event.handoffType ?? '',
              prompt: event.handoffPrompt ?? ''
            });
            void refetch();
            break;
          case 'handoff_resolved':
            setHandoff(null);
            setHandoffValue('');
            void refetch();
            break;
          case 'run_done':
          case 'run_failed':
          case 'run_aborted':
            subscription.close();
            void refetch();
            void queryClient.invalidateQueries({ queryKey: queryKeys.filingPreparations.all });
            void queryClient.invalidateQueries({ queryKey: queryKeys.compliance.all });
            if (event.kind === 'run_done') {
               success('Automation complete', 'The portal run has finished successfully.');
               onDone?.();
            } else {
               errorToast(event.error ?? 'Unknown error', 'Automation run failed');
            }
            break;
        }
      },
    });

    return () => {
      subscription.close();
    };
  }, [runId, runStatus, refetch, queryClient, success, errorToast, onDone]);

  const abortMutation = useMutation({
    mutationFn: () => abortAutomationRun(runId),
    onSuccess: () => {
      void refetch();
      success('Run aborted', 'The automation has been stopped.');
    },
    onError: (err: unknown) => {
      errorToast(err, 'Failed to abort run');
    }
  });

  const handoffMutation = useMutation({
    mutationFn: (val: string) => submitHandoff(runId, handoff!.id, val),
    onSuccess: () => {
      // Handoff state is cleared by SSE
    },
    onError: (err: unknown) => {
      errorToast(err, 'Failed to submit handoff');
    }
  });

  const handleDownloadEvidence = async () => {
    if (!run) return;
    setDownloading(true);
    try {
      await downloadEvidencePack(runId, `evidence_${run.form}_${runId.slice(-6)}.zip`);
    } catch (err: unknown) {
      errorToast(err, 'Could not download evidence pack');
    } finally {
      setDownloading(false);
    }
  };

  if (!run) return null;

  const isFinished = run.status === 'succeeded' || run.status === 'failed' || run.status === 'aborted';
  const isActive = run.status === 'running' || run.status === 'waiting_human';

  return (
    <Card className="overflow-hidden border-[var(--fd-accent)]/30 ring-1 ring-[var(--fd-accent)]/10">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isActive ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] shadow-sm shadow-[var(--fd-accent)]/30 animate-pulse' : 'bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)]'}`}>
            <Bot size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--fd-text-primary)] leading-tight">Portal Pilot (Beta)</h3>
            <p className="text-xs text-[var(--fd-text-secondary)]">Running {run.form} on {run.portal}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={
            run.status === 'succeeded' ? 'done' : 
            run.status === 'failed' || run.status === 'aborted' ? 'neutral' : 
            run.status === 'waiting_human' ? 'accent' : 'neutral'
          }>
            {run.status.replace('_', ' ')}
          </Badge>
          
          {isFinished && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadEvidence}
              loading={downloading}
              iconLeft={<Download size={14} />}
            >
              Evidence Pack
            </Button>
          )}

          {!isFinished && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              loading={abortMutation.isPending}
              onClick={() => abortMutation.mutate()}
            >
              Abort Run
            </Button>
          )}
        </div>
      </div>

      {/* Screen view */}
      <div className="relative aspect-video w-full bg-[var(--fd-surface-2)] border-b border-[var(--fd-border-subtle)] overflow-hidden flex items-center justify-center">
        {frame ? (
          <img 
            src={`data:image/jpeg;base64,${frame}`} 
            alt="Browser Live View" 
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center text-[var(--fd-text-tertiary)] gap-2">
            {isActive ? (
              <>
                <RefreshCw size={24} className="animate-spin text-[var(--fd-text-secondary)]" />
                <span className="text-sm">Connecting to browser stream...</span>
              </>
            ) : (
              <span className="text-sm">Browser closed</span>
            )}
          </div>
        )}
        
        {/* Handoff overlay */}
        {handoff && (
          <div className="absolute inset-0 bg-[var(--fd-bg)]/60 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-[var(--fd-surface-1)] rounded-xl shadow-2xl p-6 w-full max-w-md border-t-4 border-[var(--fd-accent)] space-y-4 animate-in fade-in zoom-in-95">
              <div className="space-y-1">
                <h4 className="font-bold text-lg text-[var(--fd-text-primary)]">Human Action Required</h4>
                <p className="text-sm text-[var(--fd-text-secondary)]">{handoff.prompt}</p>
              </div>
              <div className="flex gap-2">
                <Input
                  type={handoff.type === 'password' ? 'password' : 'text'}
                  value={handoffValue}
                  onChange={(e) => setHandoffValue(e.target.value)}
                  placeholder="Enter required value..."
                  className="flex-1"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && handoffValue) {
                      handoffMutation.mutate(handoffValue);
                    }
                  }}
                />
                <Button 
                  variant="primary"
                  loading={handoffMutation.isPending}
                  disabled={!handoffValue}
                  onClick={() => handoffMutation.mutate(handoffValue)}
                >
                  Submit
                </Button>
              </div>
              <p className="text-xs text-[var(--fd-status-waiting)] bg-[var(--fd-status-waiting)]/10 border border-[var(--fd-status-waiting)]/30 p-2 rounded">
                This value is encrypted and injected directly into the browser. It is never logged or stored.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Steps panel */}
      <div className="bg-[var(--fd-surface-0)]">
        <button 
          className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-[var(--fd-surface-1)] transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3 w-full max-w-md">
            <span className="text-[var(--fd-text-secondary)] flex-shrink-0">Progress</span>
            <ProgressBar 
              value={run.stepsCompleted} 
              max={run.totalSteps} 
              tone={run.status === 'failed' ? 'accent' : 'accent'}
              label="Run progress"
              className="flex-1"
            />
            <span className="text-[var(--fd-text-secondary)] text-xs flex-shrink-0 tabular-nums">
              {run.stepsCompleted} / {run.totalSteps}
            </span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-[var(--fd-text-secondary)]" /> : <ChevronDown size={16} className="text-[var(--fd-text-secondary)]" />}
        </button>

        {expanded && (
          <div className="p-4 pt-0 border-t border-[var(--fd-border-subtle)] space-y-2 mt-2">
            {run.error && (
              <div className="bg-[var(--fd-status-danger)]/10 border border-[var(--fd-status-danger)]/30 rounded-md p-3 text-sm text-[var(--fd-status-danger)] mb-4">
                <span className="font-semibold block mb-1">Execution Error</span>
                {run.error}
              </div>
            )}
            <ol className="space-y-2 text-sm">
              {run.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <div className="mt-0.5 flex-shrink-0">
                    {step.status === 'succeeded' ? <CheckCircle2 size={16} className="text-[var(--fd-status-done)]" /> :
                     step.status === 'failed' ? <XCircle size={16} className="text-[var(--fd-status-danger)]" /> :
                     step.status === 'running' || step.status === 'waiting_human' ? <RefreshCw size={14} className="text-[var(--fd-accent)] animate-spin mt-0.5" /> :
                     <Circle size={16} className="text-[var(--fd-text-tertiary)]" />}
                  </div>
                  <div className="min-w-0">
                    <span className={step.status === 'pending' ? 'text-[var(--fd-text-tertiary)]' : 'font-medium'}>
                      {step.label}
                    </span>
                    {step.error && (
                      <p className="text-xs text-[var(--fd-status-danger)] mt-0.5">{step.error}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Card>
  );
}
