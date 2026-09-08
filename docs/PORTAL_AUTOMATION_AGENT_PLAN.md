# Implementation Plan: Gov-Portal Automation Agent ("Portal Pilot")

## 1. Goal

Let FirmDesk's AI agent perform accountants' government-portal work for them — opening the portal, entering the prepared values, and pressing the buttons — while the accountant stays in a supervised, human-in-the-loop control seat.

Target portals (already modeled in the codebase):
- GST portal (`services.gst.gov.in`) — GSTR-1, GSTR-3B, GSTR-9, CMP-08
- Income Tax portal (`incometax.gov.in`) — ITR, Advance Tax
- TRACES (`tdscpc.gov.in`) — TDS 24Q / 26Q
- MCA V3 (`mca.gov.in`) — ROC MGT-7, AOC-4

---

## 2. Current State (what already exists — reuse, don't rebuild)

| Capability | Location | Status |
|---|---|---|
| Per-form prepared data (`portalPayload`, `computed`, `missingInputs`) | `backend/src/services/filingPreparation.service.ts` | Done |
| Manual portal guide steps per form | `filingPreparation` `guideSteps` | Done (describes exactly what the agent will automate) |
| Sandbox OTP + fake-ARN submission | `backend/src/services/governmentGateway.service.ts` | Stub; `isLiveGateway()` awaits `GSP_BASE_URL`/`GSP_CLIENT_ID` |
| Tool-calling AI agent (37 tools, agentic loop, scope enforcement, audit) | `backend/src/services/aiAgent.service.ts` | Done (Gemini / OpenAI / custom OpenAI-compatible) |
| Client-scope security, roles, audit logging, zod validators, rate limiting | `backend/src/middleware/*`, `lib/*` | Done — must be applied to every new endpoint |
| Job infrastructure with locks + run records | `backend/src/jobs/`, `jobRun` model | Done — pattern to follow for long-running automation runs |
| Encrypted secret storage pattern (AES-256-GCM) | `backend/src/lib/crypto.ts` | Done — reuse for portal session state |
| Frontend filing flow (prepare → OTP → submit) | `frontend/src/routes/compliance/components/GuidedFiling.tsx` | Done — gets a new "Automate in browser" path |

**Missing:** any browser-automation runtime (no Playwright/Puppeteer anywhere), real portal interaction, live-view streaming, human-handoff protocol, credential/session vault, run management.

---

## 3. Core Design Principles

1. **Supervised automation, not unattended bots.** The accountant watches every run live, and every sensitive gate (password, CAPTCHA, OTP, final FILE/SUBMIT/PAY) is a human handoff. The agent never types an OTP it obtained, never clicks a final submit without explicit confirmation.
2. **Deterministic recipes first, AI second.** Each portal+form gets a versioned "recipe" (a declarative step script with selectors). The LLM orchestrates (which filing, verifying data, explaining, recovering from failures) but does not freestyle-drive the browser except in a tightly-guarded "assisted recovery" mode.
3. **Destructive actions are never LLM-driven.** AI may propose the next click in recovery mode; `FILE`, `SUBMIT`, and payment clicks are recipe-only + human-confirmed.
4. **Secrets are ephemeral or encrypted.** Passwords typed by humans, never persisted. Session cookies (storageState) encrypted at rest with per-firm keys. OTP values live in a TTL in-memory store only, never logged, never echoed in API responses.
5. **Everything is evidence.** Every step stores a screenshot + action log; a run produces a downloadable "evidence pack" (who initiated, what was entered, what was clicked, final acknowledgement) — this doubles as the audit artifact.

---

## 4. Architecture

```
┌─────────────────────────── Backend (Express) ────────────────────────────┐
│                                                                           │
│  AI Agent (aiAgent.service)          Automation API (new)                 │
│  └─ new tools:                        │                                   │
│     start_portal_automation           ├─ POST /automation/runs            │
│     get_automation_run_status         ├─ GET  /automation/runs/:id        │
│     list_automation_runs              ├─ GET  /automation/runs/:id/events │─ SSE: live frames,
│     (handoffs stay human-only)        ├─ POST /automation/runs/:id/handoff│   step ticks, handoffs
│                                       └─ POST /automation/runs/:id/abort │
│                                                                           │
│  AutomationWorker (new, in-process)                                       │
│  ├─ Playwright (chromium, max 2 concurrent browsers)                      │
│  ├─ RecipeEngine  — executes versioned recipes per portal+form            │
│  ├─ HandoffBroker — waiting_human state, TTL, in-memory secret channel    │
│  ├─ SessionVault  — encrypted storageState per client+portal (GridFS)     │
│  ├─ ScreenCaster  — throttled JPEG frames → SSE stream (1 fps while active)│
│  └─ WriteBack     — ARN/acknowledgement → ComplianceItem + FilingPreparation│
│                    (reuses governmentGateway marking + audit logic)       │
│                                                                           │
│  New models: AutomationRun, PortalSession (Mongo)                         │
└───────────────────────────────────────────────────────────────────────────┘
                     ▲ SSE (frames/events)            ▼ handoff input (OTP…)
┌────────────────────┴─────────────── Frontend ───────┴─────────────────────┐
│  GuidedFiling card → "Run in browser (Beta)" → AutomationRunner            │
│  ├─ live portal view (SSE frames canvas)                                   │
│  ├─ step checklist with per-step screenshots                               │
│  ├─ handoff modal: password / CAPTCHA view / OTP / typed "FILE" confirm    │
│  └─ abort button, evidence-pack download                                   │
│  /automation (admin): firm-wide run monitor                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

### Why server-side Playwright (chosen), alternatives considered
- **Server-side Playwright in the backend process** (chosen): simplest for the current single-instance Render deploy; no client installs; works with OTP/EVC verification flows; live view is a natural product feature.
- **Local companion app (Electron/Tauri)** — *future phase*: required for **DSC (USB-token) signatures** since the token sits on the accountant's machine; also most robust for CAPTCHAs. Not phase 1.
- **Remote browser infra (Browserbase/Steel)** — optional later for scale; keep the worker behind an interface so it can be swapped.

---

## 5. Component Detail

### 5.1 AutomationWorker + RecipeEngine

- New service `backend/src/services/portalAutomation/`:
  - `worker.ts` — run queue (in-process, max 2 browsers), lifecycle mgmt, graceful shutdown draining
  - `recipeEngine.ts` — loads a recipe, executes steps against a Playwright `Page`, emits events
  - `recipes/<portal>/<form>.json` — versioned declarative steps:
    ```jsonc
    {
      "version": 3,
      "portal": "gst",
      "form": "GSTR3B",
      "steps": [
        { "key": "login", "action": "navigate", "url": "https://services.gst.gov.in/…" },
        { "key": "login-user", "action": "handoff", "type": "password" },        // human types creds
        { "key": "login-otp", "action": "handoff", "type": "otp" },
        { "key": "open-return", "action": "click", "role": "button", "name": "GSTR-3B" },
        { "key": "table-3-1a", "action": "fill", "map": "computed.gst.liableSupplies", "selector": "#table3_1a" },
        { "key": "save", "action": "click", "role": "button", "name": "SAVE GSTR-3B" },
        { "key": "file-confirm", "action": "click", "role": "button", "name": "FILE GSTR-3B", "confirm": "human", "typed": "FILE" },
        { "key": "capture-arn", "action": "extract", "regex": "ARN:\\s?(AA\\d{13})", "map": "result.arn" }
      ]
    }
    ```
  - `map:` values resolve against the existing `filingPreparation.portalPayload` / `computed` output — the payload the app already produces becomes the agent's data source, unchanged.
- Step result events → `AutomationRun.steps[]` with screenshot file refs (GridFS).
- **Assisted recovery** (phase 3): on a failed selector, capture accessibility tree + screenshot → LLM (`aiModels.service` provider) is asked for one candidate selector given the step's intent → one non-destructive auto-retry with evidence; if it fails again, or the step is destructive, the run goes to `waiting_human` with a "recipe needs attention / step failed" handoff.

### 5.2 Human-handoff protocol

Run enters `waiting_human` with a handoff descriptor:

| Type | Who provides | Notes |
|---|---|---|
| `password` | accountant (live modal) | streamed into the page only; never stored, never logged |
| `captcha` | accountant sees live frame, types answer | same ephemeral channel |
| `otp` | accountant (client's phone/email receives it) | this is today's manual step, now centralized in the runner UI |
| `confirm_submit` | accountant types `FILE` / `SUBMIT` / `PAY` | two-step typed confirmation; timeout auto-aborts |
| `sign` | accountant (EVC/Adhaar OTP or DSC note) | EVC = OTP handoff; DSC runs fall back to "prepare-only + resume package" until companion app exists |

- Handoff values: TTL in-memory store (pattern of `governmentGateway` challenge store but secret-safe — values never persisted, never in responses/logs).
- Timeouts: 5 min default, configurable; expiry aborts the run safely.

### 5.3 SessionVault

- First successful login per client+portal: `context.storageState()` → AES-256-GCM encrypt (reuse `lib/crypto.ts`) → store in `PortalSession` model/GridFS with `expiresAt`.
- Subsequent runs: restore state; when the portal asks to re-login, the password handoff fires again.
- Default policy: **passwords are never stored** — only session cookies. (Decision point #2 below if the firm wants stored credentials.)

### 5.4 Data model (new)

```
AutomationRun {
  clientId, complianceItemId, filingPreparationId, portal, form,
  mode: 'recipe' | 'assisted',
  status: queued | starting | running | waiting_human | succeeded | failed | aborted,
  recipeVersion, initiatedBy, actorRole,
  steps: [{ key, label, status, startedAt, finishedAt, screenshotFileId, error }],
  handoffs: [{ id, type, prompt, createdAt, resolvedAt }],   // no values stored
  result: { arn?, acknowledgementRef?, portalRef? },
  error, finishedAt
}

PortalSession { clientId, portal, encryptedState, expiresAt, lastUsedAt }
```

- `governmentGateway.service.ts` in-memory challenge Map is replaced by a Mongo TTL collection when wiring the live path (also fixes the restart-wipes-state bug noted in its tests).

### 5.5 API surface (all under `/api/v1`, behind requireAuth + client scope + `compliance:update`)

```
POST /automation/runs                 { filingPreparationId, mode? }  → starts run
GET  /automation/runs/:id             status, steps (role-aware serializer)
GET  /automation/runs/:id/events      SSE: frame | step | handoff | done
POST /automation/runs/:id/handoff     { handoffId, value }  (OTP/captcha/password/confirm)
POST /automation/runs/:id/abort
GET  /automation/runs/:id/evidence    zip: screenshots + action log + payload snapshot
GET  /automation/recipes              (admin) recipe versions + health
```

- Zod validators (`validators/automation.validators.ts`), rate limits, and audit records for start/handoff/abort/success — mirroring existing `governmentGateway` test expectations (outsider → 404, etc.).

### 5.6 AI agent integration (`aiAgent.service.ts`)

New tools in the `TOOLS` registry:
- `start_portal_automation(filingPreparationId)` — preconditions: preparation `ready`, no `missingInputs`; returns runId + first handoff prompt
- `get_automation_run_status(runId)` — current step, waiting-handoff reason
- `list_automation_runs(clientId?, status?)`
- Handoff values are **UI-only** — the LLM can trigger and monitor runs but can never supply OTP/password/confirmations (tool intentionally absent).

System prompt changes: it currently claims *"you do NOT need to click around buttons — you have direct backend tools"*; rewrite to describe the supervised browser mode, its handoffs, and evidence. New quick-prompt button: "File GSTR-3B for <client> in the browser".

### 5.7 Frontend

- `GuidedFiling.tsx`: new card action **"Run in browser (Beta)"** (replaces the "Request OTP → sandbox submit" arc for live mode; sandbox remains the demo/offline path).
- New `AutomationRunner` (route `/compliance/:complianceId/automation/:runId` or drawer):
  - live view canvas fed by SSE frames
  - step checklist; click a step → its screenshot
  - handoff modal with the input UX per type (OTP 6-box, CAPTCHA shows the frame zoomed, typed-confirmation for submits)
  - abort button; run summary with ARN + evidence download; toast on completion (same success pattern as today's sandbox ARN toast)
- `/automation` admin page: firm-wide runs table, filters (portal/status/accountant), recipe health panel.
- `ai.api.ts`/`AiChatDropdown`: new tool badges + `[ACTION]` deep-links to a run.

### 5.8 Write-back on success

- Reuse `governmentGateway`'s real marking path: set `ComplianceItem` → `filed` with the **real** ARN/acknowledgement (its format validators per form already encode expected patterns — use them to sanity-check the extracted ARN), lock `FilingPreparation`, write audit log with run + evidence references.

---

## 6. Testing Strategy

1. **Unit** — recipe step resolution (`map:` against `portalPayload`), handoff TTL/expiry, storageState encryption round-trip, ARN format validation per form.
2. **Integration** — API contract with the browser layer mocked via DI (status transitions, 404 for unassigned staff, audit records, rate limits) — extends `governmentGateway.test.ts` / `filingPreparation.test.ts` patterns.
3. **E2E against mock portals** — serve static fixture pages imitating each portal screen (login, GSTR-3B tables, file button, ARN page) inside the repo; CI runs recipes against them with a real headless browser. This keeps CI deterministic and off the real portals.
4. **Nightly optional smoke** — read-only navigation recipes against real portals (login-free pages) to detect layout drift; alerts to admins via the existing notification service when a recipe step selector stops matching.
5. **Change-drift mitigation** — recipes are versioned; a failed selector surfaces a clear "portal layout changed — recipe update required" error with the failing screenshot.

---

## 7. Security & Compliance Checklist

- [ ] Role gates + client scope on every new route (404 outsiders), audit on every state change
- [ ] Passwords/CAPTCHA/OTP values: never persisted, never logged, never echoed in API responses
- [ ] Session states encrypted at rest; expiry enforced; revocation UI per client portal
- [ ] Typed human confirmation before every FILE/SUBMIT/PAY; destructive clicks never AI-proposed
- [ ] Concurrency cap (2 browsers), per-portal politeness interval, backoff on portal errors, maintenance-window avoidance
- [ ] Client consent record: client authorizes the firm to operate their portal filings (extend `clientService` model with an authorization flag/date)
- [ ] Evidence packs: screenshots + action log per run, retained per firm policy (tie into existing document storage)
- [ ] **Legal/ToS review before pilot**: portal terms for GST/IT/TRACES/MCA may restrict automated access; for GST the sanctioned channel is a GSP/ASP API — plan the GSP integration as a parallel track (phase 5) and get an explicit risk sign-off before enabling live automation in production
- [ ] Update privacy/security documentation (Aadhaar-vault precedent exists in README)

---

## 8. Phased Delivery

| Phase | Scope | Duration | Exit criteria |
|---|---|---|---|
| **0. Feasibility spike** | Playwright against real login+nav flows (test accounts); verify OTP/CAPTCHA flows, screenshot stability, detection behavior; confirm server-browser on Render (chromium memory); spike report | 1 wk | Go/no-go on server-side approach; portal difficulty ranking |
| **1. Automation core** | Worker, RecipeEngine, `AutomationRun`/`PortalSession`, SSE live view, handoff broker, evidence packs, admin run monitor — no recipes beyond a trivial demo recipe | 3 wks | A demo recipe fills a fixture page live in the UI end-to-end |
| **2. GST GSTR-3B pilot** | Recipe for GSTR-3B (login → fill from `portalPayload` → save → human OTP/file → ARN capture → write-back); fixture-portal E2E tests | 2 wks | One real GSTR-3B filed via the runner on a test GSTIN (or fixture parity sign-off if live testing is deferred) |
| **3. AI integration** | New agent tools, prompt rewrite, assisted-recovery mode, "Run in browser" from chat + quick prompts, frontend runner polish | 2 wks | Chat can start/monitor a run; recovery mode resolves an injected selector failure |
| **4. Form expansion** | GSTR-1, CMP-08, TDS 26Q/24Q (TRACES), ITR (IT portal — hardest login), MCA V3 — ~1–2 wks per form, ordered by client volume | 4–8 wks | Each form ships with recipe + fixtures + E2E green |
| **5. Hardening + GSP track** | Nightly recipe smokes, encryption/pen review, GSP/ASP API integration for GST (sanctioned channel; uses the already-stubbed `GSP_*` env), legal sign-off, rate/politeness tuning | 2–3 wks | Production enablement checklist complete |

Ongoing maintenance budget: portals change without notice; expect periodic recipe fixes (alerting + versioned recipes minimize blast radius).

---

## 9. Deployment Notes

- Backend needs chromium at runtime: switch the Render service to Docker (or a build command running `npx playwright install --with-deps chromium`); expect ~300–500 MB RAM per browser → paid instance (render.yaml update).
- Graceful shutdown must drain active runs (abandon mid-form is unsafe — pause, don't kill).
- Keep `MAX_AGENT_ITERATIONS`-style guards for the recovery mode (limit LLM-proposed retry attempts to 1 per step, hard-capped per run).

---

## 10. Decisions Needed

1. **First portal/form for the pilot** — recommend GSTR-3B (highest volume, form the sandbox already fakes).
2. **Credential policy** — default: human types password each session, only cookies stored. Alternative: firm opts into storing portal passwords encrypted. (Recommend default.)
3. **Live-vs-fixture testing** — do we file real returns on test GSTINs during phase 2, or ship fixture-verified recipes and enable live per-firm after sign-off?
4. **GSP priority for GST** — browser-automation-first (this plan) vs. GSP-API-first (faster, sanctioned, but vendor cost + GST-only). Recommend browser-first with GSP as phase 5, given TRACES/MCA/IT have no API anyway.
5. **DSC handling** — accept EVC-only for automated filings initially, with DSC flows staying manual/hybrid until a companion app exists?
