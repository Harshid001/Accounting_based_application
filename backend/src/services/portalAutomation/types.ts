// ---------------------------------------------------------------------------
// Portal Automation — shared type definitions
// ---------------------------------------------------------------------------

import type {
  AutomationRunMode,
  AutomationStepStatus,
  HandoffType,
  PortalKey,
} from '../../lib/enums.js';

// ---------------------------------------------------------------------------
// Recipe types (loaded from JSON recipe files)
// ---------------------------------------------------------------------------

export type RecipeAction =
  'navigate' | 'click' | 'fill' | 'extract' | 'wait' | 'handoff' | 'screenshot';

export interface RecipeStep {
  /** Unique key per step, e.g. "login", "table-3-1a" */
  key: string;
  /** Human-readable label for the step */
  label?: string;
  /** The action to perform */
  action: RecipeAction;
  /** URL for navigate steps */
  url?: string;
  /** CSS selector for click/fill steps */
  selector?: string;
  /** ARIA role for click steps */
  role?: string;
  /** ARIA name for click steps */
  name?: string;
  /** Dot-path into portalPayload/computed for the fill value, e.g. "computed.section3A.taxableValue" */
  map?: string;
  /** Regex pattern for extract steps (first capture group is extracted) */
  regex?: string;
  /** Handoff type for handoff steps */
  type?: HandoffType;
  /** If true + confirm:"human", requires typed human confirmation */
  confirm?: 'human';
  /** What the user must type to confirm a destructive step */
  typed?: string;
  /** Timeout override in milliseconds */
  timeoutMs?: number;
  /** Wait duration for wait steps in milliseconds */
  waitMs?: number;
}

export interface Recipe {
  version: number;
  portal: PortalKey;
  form: string;
  steps: RecipeStep[];
}

// ---------------------------------------------------------------------------
// Run event types (emitted by the engine → SSE → frontend)
// ---------------------------------------------------------------------------

export type RunEventKind =
  | 'step_start'
  | 'step_done'
  | 'step_failed'
  | 'handoff_required'
  | 'handoff_resolved'
  | 'frame'
  | 'run_done'
  | 'run_failed'
  | 'run_aborted';

export interface RunEvent {
  kind: RunEventKind;
  runId: string;
  timestamp: number;
  stepKey?: string;
  stepIndex?: number;
  stepStatus?: AutomationStepStatus;
  error?: string;
  /** Base64-encoded JPEG for frame events */
  frameData?: string;
  /** Handoff details */
  handoffId?: string;
  handoffType?: HandoffType;
  handoffPrompt?: string;
  /** Extraction results */
  result?: Record<string, string | null>;
}

// ---------------------------------------------------------------------------
// Handoff descriptor (used between broker ↔ engine)
// ---------------------------------------------------------------------------

export interface HandoffDescriptor {
  handoffId: string;
  type: HandoffType;
  prompt: string;
  timeoutMs: number;
}

export interface HandoffResolution {
  handoffId: string;
  /** The secret value provided by the human — NEVER logged, NEVER persisted */
  value: string;
}

// ---------------------------------------------------------------------------
// Worker types
// ---------------------------------------------------------------------------

export interface RunRequest {
  runId: string;
  clientId: string;
  filingPreparationId: string;
  recipe: Recipe;
  portalPayload: Record<string, unknown>;
  computed: Record<string, unknown>;
  mode: AutomationRunMode;
}

export interface RunSummary {
  runId: string;
  status: string;
  stepsCompleted: number;
  totalSteps: number;
  arn: string | null;
  error: string | null;
}
