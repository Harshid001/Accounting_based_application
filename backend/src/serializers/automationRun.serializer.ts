import type { AutomationRunDocument } from '../models/automationRun.model.js';

export interface AutomationRunView {
  id: string;
  clientId: string;
  complianceItemId: string;
  portal: string;
  form: string;
  mode: string;
  status: string;
  stepsCompleted: number;
  totalSteps: number;
  result: Record<string, string | null>;
  error: string | null;
  finishedAt: string | null;
  createdAt: string;
  steps: Array<{
    key: string;
    label: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    hasScreenshot: boolean;
    error: string | null;
  }>;
}

export const serializeAutomationRun = (run: AutomationRunDocument): AutomationRunView => {
  return {
    id: run._id.toString(),
    clientId: run.client.toString(),
    complianceItemId: run.complianceItem.toString(),
    portal: run.portal,
    form: run.form,
    mode: run.mode,
    status: run.status,
    stepsCompleted: run.steps.filter((s) => s.status === 'succeeded').length,
    totalSteps: run.steps.length,
    result: {
      arn: run.result.arn,
      acknowledgementRef: run.result.acknowledgementRef,
      portalRef: run.result.portalRef,
    },
    error: run.error,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    steps: run.steps.map((s) => ({
      key: s.key,
      label: s.label,
      status: s.status,
      startedAt: s.startedAt?.toISOString() ?? null,
      finishedAt: s.finishedAt?.toISOString() ?? null,
      hasScreenshot: s.screenshotFileId !== null,
      error: s.error,
    })),
  };
};
