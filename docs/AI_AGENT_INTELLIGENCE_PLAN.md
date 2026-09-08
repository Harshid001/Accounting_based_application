# Plan: Portal-Agent Intelligence Layer ("Copilot 2.0")

Companion to `PORTAL_AUTOMATION_AGENT_PLAN.md` (which covers the browser-automation infrastructure — now largely built). This plan covers the **AI agent layer**: making the Copilot the top agent for Indian CA portal work — deeper reasoning, knowing exactly when to drive the browser, and a full toolkit for the portal-automation field.

---

## 1. Current Agent Status (honest inventory)

| Layer | What exists today | Location | Grade |
|---|---|---|---|
| Agentic loop | Gemini/OpenAI tool-calling loop, 8 iterations max, 20-turn history, image input, route context, tool badges, fallback replies | `backend/src/services/aiAgent.service.ts` | Solid |
| Tool registry | 44 tools across clients, filings, tasks, docs, messages, reports, settings | `aiAgent.service.ts` `TOOLS` | Broad |
| Portal automation tools | **Only 1**: `run_portal_automation` (fire-and-forget launcher) | `aiAgent.service.ts:2538` | Weak |
| Run awareness | None — agent cannot check a run's status, see handoffs, list runs, or retry | — | Missing |
| Browser automation infra | Playwright worker (2 browsers), RecipeEngine, HandoffBroker, ScreenCaster (SSE), SessionVault (AES-256-GCM), evidence packs, write-back | `backend/src/services/portalAutomation/*` | Built |
| Recipes | `gst/gstr-1`, `gst/gstr-3b`, `demo/fixture` only | `recipes/*` | 2 real forms |
| REST automation API | start/detail/SSE/handoff/abort/evidence/recipes — but no agent-facing tools for any of these except start | `backend/src/routes/automation.routes.ts` | Built |
| System prompt | Tells agent to launch runs autonomously, fall back to manual guide on error | `aiAgent.service.ts:188` | Good start |
| Decision policy | Implicit, prose-only — no structured "when to automate" rule, no recipe-support awareness, no ambiguity handling | prompt only | Missing |
| Frontend | `AutomationRunner.tsx` live feed + handoff modals; chat shows tool badges | `frontend/src/routes/compliance/components/` | Built |

**Gap in one line:** the agent can *start* a browser run but is then blind — it cannot answer "what's happening now?", "why is it waiting?", "did it succeed?", "retry it", or "which forms can you even automate?" — and it has no structured policy for when browser automation is the right move.

---

## 2. What "Top Agent" Means for This Field

Target benchmark — the Copilot should beat generic chatbots and RPA dashboards on:

1. **Full-run awareness** — it starts, monitors, explains, retries, and closes the loop on every automation run.
2. **Knows its own limits** — recipe coverage, worker capacity, session state are queryable facts, not guesses. It never claims a form is automatable when no recipe exists.
3. **Decides browser vs API vs manual** with an explicit, auditable policy (§5).
4. **Understands questions in every way** — Hinglish/Hindi, vague phrasing, multi-intent, context-dependent ("uska 3B file karo", "why is it stuck?", "file everything pending for my clients"), and asks one clarifying question instead of guessing when genuinely ambiguous.
5. **Supervised, never reckless** — human-only gates for OTP/CAPTCHA/password/final FILE stay absolute; the LLM can never supply handoff values (no tool exists for it — keep it that way).
6. **Field-complete toolkit** — 15+ portal-automation tools (§4), not 1.

---

## 3. Reasoning & Understanding Upgrades

### 3.1 Structured decision-then-act prompt

Replace the prose-only filing paragraph in `SYSTEM_PROMPT` with an explicit decision ladder the model must walk before acting:

```
FILING DECISION LADDER (always walk top-to-bottom):
1. Resolve the client (search_clients). If multiple/no match → ONE clarifying question, stop.
2. Resolve the filing + period (get_compliance_filings). Ambiguous period → ask.
3. If already filed/acknowledged → report status, do nothing else.
4. prepare_filing_return. If missing inputs → create_document_request for each missing doc,
   tell the user what was requested, STOP (no automation).
5. If status ready|locked → check_automation_support for the formCode.
   - supported → run_portal_automation, then get_automation_run_status once, then hand the
     user the live-feed ACTION link and state what handoff (OTP/CAPTCHA) to expect.
   - not supported → say exactly that, offer get_filing_guide manual steps.
6. On any tool error: report faithfully, retry ONCE if transient (e.g. worker capacity),
   then stop and advise.
```

### 3.2 Ambiguity rules (understanding "in every way")

- **Client ambiguity**: >1 client matched → ask, listing candidates with city/GSTIN disambiguators. Never pick silently.
- **Period ambiguity**: "this month" resolved against today's IST date; multi-period filings → ask.
- **Multi-intent**: "check Ravi's filings and file the 3B" → execute sequentially, report both.
- **Language**: accept Hinglish/Hindi/English (`"file karo"`, `"stuck kyu hai"`, `"ARN nikala?"`) — add explicit prompt permission + a few canonical examples. No translation layer needed; Gemini/OpenAI handle this natively when permitted.
- **Monitoring intents**: map phrasing → tools: "what's happening / kya chal raha hai / is it done?" → `get_automation_run_status`; "why is it waiting?" → status + `explain` handoff fields; "kis kis ka pending hai?" → `list_automation_runs` + filings.

### 3.3 Loop & memory upgrades

| Change | Why |
|---|---|
| `MAX_AGENT_ITERATIONS` 8 → 12, and **per-tool-call cap** instead of per-turn for monitoring turns | "file all 3 pending GSTR-3Bs for my clients" needs find+prepare×3+launch×3+status×3 |
| Active-run memory: after `run_portal_automation`, persist `runId` in the conversation context so later "is it done?" turns call status without re-launching | prevents double-launch — the classic agent footgun |
| Tool results already return `watchUrl` — extend every automation tool to return an `[ACTION]`-compatible deep link | agent replies become clickable |
| Self-correction guardrail: max 1 auto-retry per failed tool, never retry `run_portal_automation` for the same prep twice in one turn | capacity errors are transient; double-filing is not acceptable |

---

## 4. Tool Expansion (1 → 16 field tools)

All new tools join the `TOOLS` registry in `aiAgent.service.ts`, reuse existing services, and inherit scope/audit behavior. Handoff values remain UI-only (no tool, ever).

### 4.1 Run lifecycle (agent becomes run-aware)

| Tool | Args | Backed by | Purpose |
|---|---|---|---|
| `get_automation_run_status` | `runId` | `AutomationRun` + serializer + worker registry | current step, `waiting_human` reason + handoff type, elapsed, result ARN |
| `list_automation_runs` | `clientId?, status?, limit?` | `AutomationRun` find, client-scoped | "kis kis ki filing chal rahi hai?", failed runs today |
| `retry_automation_run` | `runId` | re-`executePortalAutomation` on same prep, reuses session | clean retry after transient failure |
| `abort_automation_run` | `runId` | existing abort controller | safety stop is agent-allowed (aborts are always safe) |
| `get_automation_run_summary` | `runId` | `evidencePack` index (not the zip) | step log + ARN + timings for chat reporting |

### 4.2 Portal intelligence (the "when to automate" facts)

| Tool | Args | Backed by | Purpose |
|---|---|---|---|
| `check_automation_support` | `formCode?` / none | `loadRecipe` registry + `RECIPE_FILE_BY_FORM` | which forms are automation-ready + recipe health/version — the agent's honest menu |
| `get_automation_metrics` | `period?` | `AutomationRun` aggregation | success rate, avg duration, handoff resolution time — "how is the automation doing?" |
| `get_portal_session_status` | `clientId, portal` | `PortalSession` (metadata only, no secrets) | "will it need password again?" |
| `revoke_portal_session` | `clientId, portal` | `sessionVault` delete | security hygiene on demand |

### 4.3 Filing orchestration

| Tool | Args | Backed by | Purpose |
|---|---|---|---|
| `get_filing_preparation` | `preparationId \| complianceItemId` | `getPreparation` (already imported!) | inspect computed values/missing inputs without re-preparing |
| `list_pending_automatable_filings` | `clientId?` (admin: none = firm-wide) | filings + `check_automation_support` join | the "file everything pending" starting point |
| `bulk_run_portal_automation` | `filingPreparationIds[]` (cap 5/turn) | loops `executePortalAutomation` with capacity awareness | batch filing with per-run report |
| `schedule_automation_run` | `filingPreparationId, at` | jobs infra (`backend/src/jobs/`) | queue for off-peak/maintenance-window politeness |

### 4.4 Status page (what the agent becomes)

```
Today's portal-automation coverage:
  GST: GSTR-1 ✓  GSTR-3B ✓  GSTR-9 (recipe pending)  CMP-08 (recipe pending)
  TDS / IT / ROC: manual guide only (recipes phase 4)
Live runs: 1 running (Sharma Traders GSTR-3B, step 4/9, waiting OTP),
           1 succeeded today (ARN AA…), 0 failed
```

This is the "show the status of our agent" capability — fully answerable from tools, zero hallucination.

---

## 5. When to Do Browser Automation (decision matrix)

Encoded both in the prompt ladder (§3.1) and enforced by tool preconditions:

| Situation | Agent action |
|---|---|
| Prep `ready`/`locked` + recipe exists + user asked to file/automate | `run_portal_automation` (or bulk) |
| Prep has `missingInputs` | `create_document_request` per missing input + stop |
| Form has no recipe (GSTR-9, ITR, MCA today) | say so explicitly + offer `get_filing_guide` |
| Filing already `filed`/`acknowledged` | report ARN/status, no action |
| User asks "how do I file manually" | `get_filing_guide`, never launch |
| Run is `waiting_human` | status + explain the exact handoff (OTP/CAPTCHA/password) + live-feed link; never supply values |
| Worker at capacity | report + optional single retry + suggest off-peak schedule |
| Destructive step (FILE/SUBMIT/PAY) | recipe-driven + typed human confirmation only — permanent rule, no LLM proposal |
| Session expired | status says re-login needed → password handoff via UI |

---

## 6. Delivery Phases

| Phase | Scope | Status |
|---|---|---|
| **A. Run-awareness** | 5 lifecycle tools (`get_automation_run_status`, `list_automation_runs`, `retry_automation_run`, `abort_automation_run`, `run_summary` via status) + status badges in chat + **double-launch guard** (409 on second live run per preparation — enforced in service layer) | ✅ **Shipped** — `aiAgent.service.ts`, `automationRun.service.ts` |
| **B. Decision policy + reasoning** | Prompt ladder rewrite (6-step FILING DECISION LADDER), ambiguity + Hinglish rules, monitoring intents, iteration cap 8→12, retry guardrails, `check_automation_support` + `get_filing_preparation` tools | ✅ **Shipped** |
| **C. Portal intelligence + orchestration** | `get_automation_metrics`, `get_portal_session_status` (metadata-only), `revoke_portal_session`, `list_pending_automatable_filings`, `bulk_run_portal_automation` (cap 5); fallback-mode automation status branch | ✅ **Shipped** — 44→55 tools, 303 tests green |
| **D. Form coverage compounding (ongoing)** | each new recipe (GSTR-9, CMP-08, TDS 26Q/24Q, ITR, MCA per master-plan phases) auto-appears in agent's menu via `check_automation_support` — zero agent changes needed per recipe | 🔜 Ongoing with master plan |
| **E. Proactive mode** | deadline-driven suggestions: daily job (`suggestAutomationRuns`, cron 07:30 IST) finds automatable filings due within 7 days (recipe exists, no live run) and surfaces them in the admin digest email; human still launches or approves | ✅ **Shipped** — `automationSuggester.service.ts`, `suggestAutomationRuns.job.ts`, digest section, 7 tests |

### Tests (extend `backend` vitest patterns)

1. ~~Tool unit tests~~ ✅ `tests/integration/agentAutomationTools.test.ts` (13 tests: scope enforcement, session metadata-only leak check, double-launch guard, honest coverage menu, fallback answers)
2. Agent behavior tests: scripted Gemini/OpenAI mock — ladder compliance (ambiguous client → question; missing inputs → doc requests; no-recipe form → honest decline) — *requires a provider-mock harness; deferred*
3. ~~Double-launch protection~~ ✅ covered
4. Prompt regression: golden-file assertions on the decision ladder section — *deferred with #2*

---

## 7. Non-Negotiables (carried from master plan)

- OTP/CAPTCHA/password/typed-FILE values: human UI only — no tool will ever exist to supply them.
- Destructive clicks: recipe + human confirmation only.
- Every tool: client scope, role gates, audit log, zod validators, rate limits.
- The agent reports errors faithfully (worker capacity, recipe drift) — never fabricates ARNs; `get_automation_run_status` is the only source of run truth.

---

## 8. Decisions Needed

1. ~~Iteration cap raise (8→12)~~ ✅ shipped with per-tool retry guardrail.
2. Bulk cap 5/turn — shipped flat (role-independent); revisit if abuse appears.
3. ~~Scheduling~~ — `schedule_automation_run` tool deferred; Phase E uses the daily digest job instead (simpler, no new attack surface).
4. Proactive suggestions (phase E) — **shipped as digest-only** (no auto-launch, no notification spam); runs daily 07:30 IST before the 08:00 admin digest, also manually triggerable via the admin jobs API (`suggestAutomationRuns` is in `JOB_NAMES`). Consent flags folded into master-plan's client-authorization work.
